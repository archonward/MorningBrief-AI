import type { Settings } from "../config/settings.js";

type LogLevel = Settings["logLevel"];

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export interface Logger {
  debug(message: string, details?: unknown): void;
  info(message: string, details?: unknown): void;
  warn(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
}

export function createLogger(level: LogLevel): Logger {
  function write(messageLevel: LogLevel, message: string, details?: unknown): void {
    if (priorities[messageLevel] < priorities[level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${messageLevel.toUpperCase()} ${message}`;

    if (details === undefined) {
      console[messageLevel](line);
      return;
    }

    console[messageLevel](line, details);
  }

  return {
    debug: (message, details) => write("debug", message, details),
    info: (message, details) => write("info", message, details),
    warn: (message, details) => write("warn", message, details),
    error: (message, details) => write("error", message, details)
  };
}
