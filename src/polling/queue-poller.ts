import type { Client, TextChannel, ThreadChannel } from "discord.js";
import { ChannelType } from "discord.js";
import { getSonarr } from "../services/sonarr.js";
import { getRadarr } from "../services/radarr.js";
import {
  getAllTrackedRequests,
  getTrackedRequest,
  type TrackedRequest,
} from "../store/request-store.js";
import { buildThreadProgressMessage } from "../embeds/request-status.js";
import { getLogger } from "../logger.js";

export async function pollQueues(client: Client): Promise<void> {
  const logger = getLogger();
  const tracked = getAllTrackedRequests();

  if (tracked.length === 0) return;

  let sonarrQueue;
  let radarrQueue;

  try {
    sonarrQueue = await getSonarr().getQueue(1, 100);
  } catch (error) {
    logger.debug({ error }, "Failed to fetch Sonarr queue");
  }

  try {
    radarrQueue = await getRadarr().getQueue(1, 100);
  } catch (error) {
    logger.debug({ error }, "Failed to fetch Radarr queue");
  }

  for (const request of tracked) {
    if (!request.channelId || !request.messageId) continue;

    let progress: number | undefined;
    let size: number | undefined;
    let sizeLeft: number | undefined;
    let eta: string | undefined;
    let quality: string | undefined;
    let downloading = false;

    if (request.mediaType === "movie" && radarrQueue) {
      for (const item of radarrQueue.records) {
        if (item.movie?.tmdbId === request.tmdbId) {
          downloading = true;
          size = item.size;
          sizeLeft = item.sizeleft;
          progress = size > 0 ? ((size - sizeLeft) / size) * 100 : 0;
          eta = item.timeleft;
          quality = item.quality.quality.name;
          break;
        }
      }
    }

    if (request.mediaType === "tv" && sonarrQueue) {
      for (const item of sonarrQueue.records) {
        const series = item.series;
        if (series?.tvdbId) {
          // Match by external service ID if available
          downloading = true;
          size = (size ?? 0) + item.size;
          sizeLeft = (sizeLeft ?? 0) + item.sizeleft;
          if (size > 0) {
            progress = ((size - sizeLeft) / size) * 100;
          }
          if (!eta && item.timeleft) eta = item.timeleft;
          if (!quality) quality = item.quality.quality.name;
        }
      }
    }

    if (!downloading) continue;

    if (
      request.lastProgress !== undefined &&
      progress !== undefined &&
      Math.abs(progress - request.lastProgress) < 5
    ) {
      continue;
    }

    request.lastProgress = progress;

    await updateThread(client, request, {
      title: request.title,
      posterPath: request.posterPath,
      status: "downloading",
      progress,
      size,
      sizeLeft,
      eta,
      quality,
    });
  }
}

async function updateThread(
  client: Client,
  request: TrackedRequest,
  statusInfo: {
    title: string;
    posterPath?: string;
    status: "downloading";
    progress?: number;
    size?: number;
    sizeLeft?: number;
    eta?: string;
    quality?: string;
  },
): Promise<void> {
  const logger = getLogger();

  if (!request.threadId) return;

  try {
    const thread = (await client.channels.fetch(request.threadId)) as ThreadChannel | null;
    if (!thread || thread.type !== ChannelType.PublicThread) return;

    const message = buildThreadProgressMessage(statusInfo);

    if (request.lastThreadMessageId) {
      try {
        const existingMsg = await thread.messages.fetch(request.lastThreadMessageId);
        await existingMsg.edit(message);
        return;
      } catch {
        // message was deleted or not found, send new one
      }
    }

    const sent = await thread.send(message);
    request.lastThreadMessageId = sent.id;
  } catch (error) {
    logger.debug({ error, threadId: request.threadId }, "Failed to update thread");
  }
}
