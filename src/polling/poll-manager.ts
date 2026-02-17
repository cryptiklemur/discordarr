import type { Client } from "discord.js";
import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import { pollQueues } from "./queue-poller.js";
import { checkAvailability } from "./availability-checker.js";
import { pollNewRequests } from "./request-poller.js";

let stopped = false;

function scheduleLoop(fn: () => Promise<void>, intervalMs: number, label: string): void {
  const logger = getLogger();

  const run = async () => {
    if (stopped) return;
    try {
      await fn();
    } catch (error) {
      logger.error({ error }, `${label} error`);
    }
    if (!stopped) {
      setTimeout(run, intervalMs);
    }
  };

  setTimeout(run, intervalMs);
}

export function startPolling(client: Client): void {
  const config = loadConfig();
  const logger = getLogger();

  const queueMs = config.POLL_INTERVAL_SECONDS * 1000;
  const availabilityMs = config.AVAILABILITY_CHECK_INTERVAL_SECONDS * 1000;

  logger.info(
    { queueInterval: config.POLL_INTERVAL_SECONDS, availabilityInterval: config.AVAILABILITY_CHECK_INTERVAL_SECONDS },
    "Starting polling",
  );

  stopped = false;

  pollNewRequests(client).catch((error) => logger.error({ error }, "Initial request poll error"));

  scheduleLoop(() => pollQueues(client), queueMs, "Queue poll");
  scheduleLoop(() => checkAvailability(client), availabilityMs, "Availability check");
  scheduleLoop(() => pollNewRequests(client), queueMs, "Request poll");
}

export function stopPolling(): void {
  stopped = true;
}
