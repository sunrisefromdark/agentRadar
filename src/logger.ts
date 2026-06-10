import type { RuntimeConfig } from "./config.ts";

type LogLevel = RuntimeConfig["logging"]["level"];

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly config: RuntimeConfig["logging"]) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVELS[level] < LEVELS[this.config.level]) return;
    if (this.config.json) {
      console.log(JSON.stringify({ level, message, ...meta, ts: new Date().toISOString() }));
      return;
    }
    const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[${level}] ${message}${suffix}`);
  }
}
