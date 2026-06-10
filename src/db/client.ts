import { Pool as PostgresPool, type PoolConfig } from "pg";
import { readDatabaseConfig, type SupportedDatabaseDialect } from "./config.ts";

export interface DbRow extends Record<string, unknown> {}

export interface DbQueryResult<R extends DbRow = DbRow> {
  rows: R[];
  rowCount: number;
}

export interface DbClient {
  readonly dialect: SupportedDatabaseDialect;
  query<R extends DbRow = DbRow>(text: string, values?: unknown[]): Promise<DbQueryResult<R>>;
}

export interface DbConnectionProbeResult {
  reachable: boolean;
  detail?: string;
}

interface MysqlQueryResultHeader {
  affectedRows?: number;
}

interface MysqlPoolConnectionLike {
  config: object;
  connect(callback?: (error: unknown) => void): void;
  destroy(): void;
  query(sql: string, parameters: Array<unknown>): {
    stream: <T>(options: { highWaterMark?: number; objectMode?: true }) => AsyncIterableIterator<T>;
  };
  query(sql: string, parameters: Array<unknown>, callback: (error: unknown, result: unknown) => void): void;
  threadId: number;
  release(): void;
}

interface MysqlPoolLike {
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
  getConnection(): Promise<MysqlPoolConnectionLike>;
  end(): Promise<void>;
}

interface MysqlModuleLike {
  createPool(options: Record<string, unknown>): MysqlPoolLike;
}

let postgresPool: PostgresPool | null = null;
let mysqlPoolPromise: Promise<MysqlPoolLike> | null = null;

function makePostgresPoolConfig(): PoolConfig {
  return {
    connectionString: readDatabaseConfig().connectionString,
  };
}

function buildMysqlPoolOptions(connectionString: string): Record<string, unknown> {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\/+/, "");
  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return {
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: databaseName,
    charset: "utf8mb4",
    timezone: "Z",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

async function importMysqlModule(): Promise<MysqlModuleLike> {
  const moduleName = "mysql2/promise";
  try {
    return (await import(moduleName)) as MysqlModuleLike;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`MySQL support requires the mysql2 package to be installed: ${detail}`);
  }
}

function normalizeMysqlQueryResult<R extends DbRow>(result: unknown): DbQueryResult<R> {
  if (Array.isArray(result)) {
    return {
      rows: result as R[],
      rowCount: result.length,
    };
  }

  const header = result as MysqlQueryResultHeader | null;
  return {
    rows: [],
    rowCount: Number.isFinite(header?.affectedRows) ? Number(header?.affectedRows) : 0,
  };
}

function adaptMysqlPool(pool: MysqlPoolLike) {
  return {
    getConnection(callback: (error: unknown, connection: MysqlPoolConnectionLike) => void): void {
      pool.getConnection().then(
        (connection) => callback(null, connection),
        (error) => callback(error, {} as MysqlPoolConnectionLike),
      );
    },
    end(callback: (error: unknown) => void): void {
      pool.end().then(
        () => callback(null),
        (error) => callback(error),
      );
    },
  };
}

export function getPostgresPool(): PostgresPool {
  postgresPool ??= new PostgresPool(makePostgresPoolConfig());
  return postgresPool;
}

export async function getMysqlPool(): Promise<MysqlPoolLike> {
  mysqlPoolPromise ??= (async () => {
    const mysql = await importMysqlModule();
    return mysql.createPool(buildMysqlPoolOptions(readDatabaseConfig().connectionString));
  })();
  return mysqlPoolPromise;
}

export async function getMysqlDialectPool() {
  return adaptMysqlPool(await getMysqlPool());
}

export async function closeDbPool(): Promise<void> {
  const mysqlPool = mysqlPoolPromise ? await mysqlPoolPromise : null;
  mysqlPoolPromise = null;
  if (mysqlPool) {
    await mysqlPool.end();
  }

  if (!postgresPool) return;
  const activePool = postgresPool;
  postgresPool = null;
  await activePool.end();
}

export const databaseDbClient: DbClient = {
  get dialect() {
    return readDatabaseConfig().dialect;
  },
  async query<R extends DbRow = DbRow>(text: string, values?: unknown[]): Promise<DbQueryResult<R>> {
    const config = readDatabaseConfig();
    if (config.dialect === "postgres") {
      const result = await getPostgresPool().query(text, values);
      return {
        rows: result.rows as R[],
        rowCount: result.rowCount ?? result.rows.length,
      };
    }

    const pool = await getMysqlPool();
    const [result] = await pool.query(text, values);
    return normalizeMysqlQueryResult<R>(result);
  },
};

export const postgresDbClient = databaseDbClient;

export function compileSqlPlaceholders(dialect: SupportedDatabaseDialect, template: string): string {
  if (dialect !== "postgres") return template;

  let parameterIndex = 0;
  return template.replace(/\?/g, () => `$${++parameterIndex}`);
}

export async function probeDatabaseConnection(db: DbClient = databaseDbClient): Promise<DbConnectionProbeResult> {
  try {
    await db.query("select 1");
    return { reachable: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { reachable: false, detail };
  }
}
