import pino from "pino";
import { loadConfig } from "./config.js";

let logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (logger) return logger;
  const config = loadConfig();
  logger = pino({ level: config.LOG_LEVEL });
  return logger;
}
