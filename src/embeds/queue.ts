import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { SonarrQueueItem } from "../services/sonarr.js";
import type { RadarrQueueItem } from "../services/radarr.js";
import { CustomId, EmbedColor } from "../utils/constants.js";
import { progressBar } from "../utils/progress-bar.js";
import { formatFileSize, formatEta, truncate, formatSeasonEpisode } from "../utils/format.js";

export interface QueueEmbedResult {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

export function buildQueueEmbed(
  items: (SonarrQueueItem | RadarrQueueItem)[],
  service: "sonarr" | "radarr"
): QueueEmbedResult {
  if (items.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`${service === "sonarr" ? "Sonarr" : "Radarr"} Queue`)
      .setDescription("Queue is empty")
      .setColor(EmbedColor.INFO)
      .setTimestamp();

    return { embeds: [embed], components: [] };
  }

  const displayItems = items.slice(0, 10);
  const fields: { name: string; value: string; inline: boolean }[] = [];

  displayItems.forEach((item) => {
    let title: string;
    if ("seriesId" in item && item.series) {
      const episode = item.episode;
      const epInfo = episode
        ? formatSeasonEpisode(episode.seasonNumber, episode.episodeNumber)
        : `S${item.seasonNumber}`;
      title = `${truncate(item.series.title, 40)} - ${epInfo}`;
      if (episode?.title) {
        title += ` - ${truncate(episode.title, 30)}`;
      }
    } else if ("movieId" in item && item.movie) {
      title = `${truncate(item.movie.title, 50)} (${item.movie.year})`;
    } else {
      title = truncate(item.title, 60);
    }

    const downloaded = item.size - item.sizeleft;
    const percent = item.size > 0 ? ((downloaded / item.size) * 100) : 0;
    const progress = progressBar(percent);
    const sizeInfo = `${formatFileSize(downloaded)} / ${formatFileSize(item.size)}`;
    const eta = item.timeleft ? formatEta(item.timeleft) : "Unknown";
    const quality = item.quality.quality.name;

    let statusLine = `**Status:** ${item.status}`;
    if (item.trackedDownloadStatus) {
      statusLine += ` (${item.trackedDownloadStatus})`;
    }

    const value = [
      `**Quality:** ${quality}`,
      `**Progress:** ${progress}`,
      `**Size:** ${sizeInfo}`,
      `**ETA:** ${eta}`,
      statusLine,
    ].join("\n");

    fields.push({ name: title, value, inline: false });
  });

  const embed = new EmbedBuilder()
    .setTitle(`${service === "sonarr" ? "Sonarr" : "Radarr"} Queue`)
    .setColor(EmbedColor.DOWNLOADING)
    .addFields(fields)
    .setTimestamp();

  if (items.length > displayItems.length) {
    embed.setFooter({ text: `Showing ${displayItems.length} of ${items.length} items` });
  } else {
    embed.setFooter({ text: `${items.length} item${items.length === 1 ? "" : "s"}` });
  }

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  const maxButtonRows = 5;
  let currentRow: ButtonBuilder[] = [];
  let rowCount = 0;

  for (const item of displayItems) {
    if (rowCount >= maxButtonRows) {
      break;
    }

    const hasIssue = item.trackedDownloadStatus === "warning" || item.trackedDownloadStatus === "error";

    const buttons: ButtonBuilder[] = [];

    if (hasIssue) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${CustomId.QUEUE_RETRY}:${service}:${item.id}`)
          .setLabel("Retry")
          .setStyle(ButtonStyle.Primary)
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${CustomId.QUEUE_REMOVE}:${service}:${item.id}`)
        .setLabel("Remove")
        .setStyle(ButtonStyle.Danger)
    );

    if (currentRow.length + buttons.length <= 5) {
      currentRow.push(...buttons);
    } else {
      if (currentRow.length > 0) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(currentRow));
        rowCount++;
        currentRow = [];
      }

      if (rowCount < maxButtonRows) {
        currentRow.push(...buttons);
      } else {
        break;
      }
    }
  }

  if (currentRow.length > 0 && rowCount < maxButtonRows) {
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(currentRow));
  }

  return { embeds: [embed], components };
}
