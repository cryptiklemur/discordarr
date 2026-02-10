import pino from "pino";
import { loadConfig } from "./config.js";

let logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (logger) return logger;
  const config = loadConfig();
  logger = pino({
    level: config.LOG_LEVEL,
    serializers: {
      error(err: unknown) {
        if (!(err instanceof Error)) return err;
        const serialized: Record<string, unknown> = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
        if (err instanceof AggregateError) {
          serialized.errors = err.errors.map((e: unknown) =>
            e instanceof Error ? { name: e.name, message: e.message } : String(e),
          );
        }
        return serialized;
      },
    },
  });
  return logger;
}
