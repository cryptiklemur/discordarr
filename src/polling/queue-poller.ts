import type { Client, TextChannel, ThreadChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getSonarr } from "../services/sonarr.js";
import { getRadarr } from "../services/radarr.js";
import {
  getAllTrackedRequests,
  updateLastProgress,
  type TrackedRequest,
} from "../store/request-store.js";
import { EmbedColor } from "../utils/constants.js";
import { progressBar } from "../utils/progress-bar.js";
import { formatFileSize, formatEta } from "../utils/format.js";
import { getLogger } from "../logger.js";

const activeDownloads = new Map<number, Set<string>>();

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

    const currentItems = new Set<string>();
    const itemLabels = new Map<string, string>();

    if (request.mediaType === "movie" && radarrQueue) {
      for (const item of radarrQueue.records) {
        if (item.movie?.tmdbId === request.tmdbId) {
          downloading = true;
          size = item.size;
          sizeLeft = item.sizeleft;
          progress = size > 0 ? ((size - sizeLeft) / size) * 100 : 0;
          eta = item.timeleft;
          quality = item.quality.quality.name;
          currentItems.add("movie");
          itemLabels.set("movie", request.title);
          break;
        }
      }
    }

    if (request.mediaType === "tv" && sonarrQueue && request.tvdbId) {
      for (const item of sonarrQueue.records) {
        if (item.series?.tvdbId === request.tvdbId) {
          downloading = true;
          size = (size ?? 0) + item.size;
          sizeLeft = (sizeLeft ?? 0) + item.sizeleft;
          if (size > 0) {
            progress = ((size - sizeLeft) / size) * 100;
          }
          if (!eta && item.timeleft) eta = item.timeleft;
          if (!quality) quality = item.quality.quality.name;

          const ep = item.episode;
          if (ep) {
            const key = `S${String(ep.seasonNumber).padStart(2, "0")}E${String(ep.episodeNumber).padStart(2, "0")}`;
            currentItems.add(key);
            itemLabels.set(key, ep.title ? `${key} - ${ep.title}` : key);
          }
        }
      }
    }

    const previousItems = activeDownloads.get(request.requestId);
    if (previousItems) {
      const completed: string[] = [];
      for (const key of previousItems) {
        if (!currentItems.has(key)) {
          completed.push(itemLabels.get(key) ?? key);
        }
      }

      if (completed.length > 0 && request.threadId) {
        await notifyDownloadComplete(client, request, completed, logger);
      }
    }

    if (currentItems.size > 0) {
      activeDownloads.set(request.requestId, currentItems);
    } else if (previousItems && previousItems.size > 0) {
      activeDownloads.delete(request.requestId);
    }

    if (!downloading) {
      if (request.mediaType === "tv" && request.tvdbId) {
        await checkCaughtUp(client, request, logger);
      }
      continue;
    }

    caughtUpRequests.delete(request.requestId);

    if (progress !== undefined) {
      updateLastProgress(request.requestId, progress);
    }

    await updateParentEmbed(client, request, { progress, size, sizeLeft, eta, quality });
  }
}

async function notifyDownloadComplete(
  client: Client,
  request: TrackedRequest,
  completedItems: string[],
  logger: ReturnType<typeof getLogger>,
): Promise<void> {
  if (!request.threadId) return;

  try {
    const thread = (await client.channels.fetch(request.threadId)) as ThreadChannel | null;
    if (!thread) return;

    for (const item of completedItems) {
      const ping = request.discordUserId ? `<@${request.discordUserId}> ` : "";
      await thread.send(`${ping}**${item}** has finished downloading!`);
    }
  } catch (error) {
    logger.debug({ error, threadId: request.threadId }, "Failed to post download completion to thread");
  }
}

const caughtUpRequests = new Set<number>();

async function checkCaughtUp(
  client: Client,
  request: TrackedRequest,
  logger: ReturnType<typeof getLogger>,
): Promise<void> {
  if (!request.channelId || !request.messageId || !request.tvdbId) return;

  try {
    const series = await getSonarr().getSeriesByTvdbId(request.tvdbId);
    if (!series) return;

    const episodeCount = series.statistics?.episodeCount ?? series.episodeCount;
    const fileCount = series.statistics?.episodeFileCount ?? series.episodeFileCount;

    if (episodeCount === 0 || fileCount < episodeCount) return;

    if (caughtUpRequests.has(request.requestId)) return;
    caughtUpRequests.add(request.requestId);

    const channel = (await client.channels.fetch(request.channelId)) as TextChannel | null;
    if (!channel) return;

    const message = await channel.messages.fetch(request.messageId);
    const embed = message.embeds[0];
    if (!embed) return;

    const progressFields = new Set(["Status", "Progress", "Size", "ETA", "Download Quality"]);
    const keepFields = (embed.fields ?? []).filter((f) => !progressFields.has(f.name));

    const updatedEmbed = EmbedBuilder.from(embed)
      .setColor(EmbedColor.INFO)
      .setFields(...keepFields);

    updatedEmbed.addFields({ name: "Status", value: "Caught Up - Waiting for new episodes", inline: true });
    updatedEmbed.setFooter({ text: "Last Updated" });
    updatedEmbed.setTimestamp(new Date());

    await message.edit({ embeds: [updatedEmbed], components: [] });

    logger.info({ requestId: request.requestId, title: request.title, episodeCount, fileCount }, "TV show caught up");
  } catch (error) {
    logger.debug({ error, requestId: request.requestId }, "Failed to check caught-up status");
  }
}

async function updateParentEmbed(
  client: Client,
  request: TrackedRequest,
  info: {
    progress?: number;
    size?: number;
    sizeLeft?: number;
    eta?: string;
    quality?: string;
  },
): Promise<void> {
  const logger = getLogger();

  if (!request.channelId || !request.messageId) return;

  try {
    const channel = (await client.channels.fetch(request.channelId)) as TextChannel | null;
    if (!channel) return;

    const message = await channel.messages.fetch(request.messageId);
    const embed = message.embeds[0];
    if (!embed) return;

    const progressFields = new Set(["Status", "Progress", "Size", "ETA", "Download Quality"]);
    const keepFields = (embed.fields ?? []).filter((f) => !progressFields.has(f.name));

    const updatedEmbed = EmbedBuilder.from(embed)
      .setColor(EmbedColor.DOWNLOADING)
      .setFields(...keepFields);

    updatedEmbed.addFields({ name: "Status", value: "Downloading", inline: true });

    if (info.quality) {
      updatedEmbed.addFields({ name: "Download Quality", value: info.quality, inline: true });
    }

    if (info.progress !== undefined) {
      updatedEmbed.addFields({ name: "Progress", value: progressBar(info.progress), inline: false });
    }

    if (info.size && info.sizeLeft !== undefined) {
      const downloaded = info.size - info.sizeLeft;
      updatedEmbed.addFields({
        name: "Size",
        value: `${formatFileSize(downloaded)} / ${formatFileSize(info.size)}`,
        inline: true,
      });
    }

    if (info.eta) {
      updatedEmbed.addFields({ name: "ETA", value: formatEta(info.eta), inline: true });
    }

    updatedEmbed.setFooter({ text: "Last Updated" });
    updatedEmbed.setTimestamp(new Date());

    await message.edit({ embeds: [updatedEmbed], components: [] });
  } catch (error) {
    logger.debug({ error, messageId: request.messageId }, "Failed to update parent embed");
  }
}
