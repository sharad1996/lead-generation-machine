type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
  if (env in levelOrder) return env;
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[minLevel()];
}

function format(level: LogLevel, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const suffix = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] [${level.toUpperCase()}] ${message}${suffix}`;
}

export const logger = {
  debug(message: string, meta?: unknown) {
    if (shouldLog("debug")) console.debug(format("debug", message, meta));
  },
  info(message: string, meta?: unknown) {
    if (shouldLog("info")) console.info(format("info", message, meta));
  },
  warn(message: string, meta?: unknown) {
    if (shouldLog("warn")) console.warn(format("warn", message, meta));
  },
  error(message: string, meta?: unknown) {
    if (shouldLog("error")) console.error(format("error", message, meta));
  },
};
