export type SupportedDatabaseDialect = "postgres" | "mysql";

export interface DatabaseConfig {
  dialect: SupportedDatabaseDialect;
  connectionString: string;
}

function parseDatabaseDialect(connectionString: string): SupportedDatabaseDialect {
  const protocol = new URL(connectionString).protocol.toLowerCase();
  if (protocol === "postgres:" || protocol === "postgresql:") {
    return "postgres";
  }
  if (protocol === "mysql:") {
    return "mysql";
  }
  throw new Error("DATABASE_URL must use the postgres://, postgresql://, or mysql:// scheme.");
}

export function readDatabaseConfig(): DatabaseConfig {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for database-backed user state.");
  }

  return {
    dialect: parseDatabaseDialect(value),
    connectionString: value,
  };
}

export function readDatabaseUrl(): string {
  return readDatabaseConfig().connectionString;
}
