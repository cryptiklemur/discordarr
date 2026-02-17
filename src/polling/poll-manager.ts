import type { Client } from "discord.js";
import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import { pollQueues } from "./queue-poller.js";
import { checkAvailability } from "./availability-checker.js";
import { pollNewRequests } from "./request-poller.js";

let queueInterval: ReturnType<typeof setInterval> | null = null;
let availabilityInterval: ReturnType<typeof setInterval> | null = null;
let requestPollInterval: ReturnType<typeof setInterval> | null = null;

export function startPolling(client: Client): void {
  const config = loadConfig();
  const logger = getLogger();

  const queueMs = config.POLL_INTERVAL_SECONDS * 1000;
  const availabilityMs = config.AVAILABILITY_CHECK_INTERVAL_SECONDS * 1000;

  logger.info(
    { queueInterval: config.POLL_INTERVAL_SECONDS, availabilityInterval: config.AVAILABILITY_CHECK_INTERVAL_SECONDS },
    "Starting polling",
  );

  pollNewRequests(client).catch((error) => logger.error({ error }, "Initial request poll error"));

  queueInterval = setInterval(async () => {
    try {
      await pollQueues(client);
    } catch (error) {
      logger.error({ error }, "Queue poll error");
    }
  }, queueMs);

  availabilityInterval = setInterval(async () => {
    try {
      await checkAvailability(client);
    } catch (error) {
      logger.error({ error }, "Availability check error");
    }
  }, availabilityMs);

  requestPollInterval = setInterval(async () => {
    try {
      await pollNewRequests(client);
    } catch (error) {
      logger.error({ error }, "Request poll error");
    }
  }, queueMs);
}

export function stopPolling(): void {
  if (queueInterval) {
    clearInterval(queueInterval);
    queueInterval = null;
  }
  if (availabilityInterval) {
    clearInterval(availabilityInterval);
    availabilityInterval = null;
  }
  if (requestPollInterval) {
    clearInterval(requestPollInterval);
    requestPollInterval = null;
  }
}
