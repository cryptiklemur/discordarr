import { EmbedBuilder } from "discord.js";
import { EmbedColor, TMDB_IMAGE_BASE, TMDB_POSTER_SIZE } from "../utils/constants.js";
import { progressBar } from "../utils/progress-bar.js";
import { formatFileSize, formatEta } from "../utils/format.js";

export interface StatusInfo {
  title: string;
  posterPath?: string;
  status: "pending" | "approved" | "downloading" | "available" | "denied";
  progress?: number;
  size?: number;
  sizeLeft?: number;
  eta?: string;
  quality?: string;
}

export function buildRequestStatusEmbed(info: StatusInfo): EmbedBuilder {
  const colorMap = {
    pending: EmbedColor.PENDING,
    approved: EmbedColor.SUCCESS,
    downloading: EmbedColor.DOWNLOADING,
    available: EmbedColor.AVAILABLE,
    denied: EmbedColor.DENIED,
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[info.status])
    .setTitle(info.title);

  if (info.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${info.posterPath}`);
  }

  const statusLabels: Record<string, string> = {
    pending: "Pending Approval",
    approved: "Approved - Waiting for Download",
    downloading: "Downloading",
    available: "Available",
    denied: "Denied",
  };

  embed.addFields({ name: "Status", value: statusLabels[info.status], inline: true });

  if (info.quality) {
    embed.addFields({ name: "Quality", value: info.quality, inline: true });
  }

  if (info.status === "downloading" && info.progress !== undefined) {
    embed.addFields({
      name: "Progress",
      value: progressBar(info.progress),
      inline: false,
    });

    if (info.size && info.sizeLeft !== undefined) {
      const downloaded = info.size - info.sizeLeft;
      embed.addFields({
        name: "Size",
        value: `${formatFileSize(downloaded)} / ${formatFileSize(info.size)}`,
        inline: true,
      });
    }

    if (info.eta) {
      embed.addFields({
        name: "ETA",
        value: formatEta(info.eta),
        inline: true,
      });
    }
  }

  return embed;
}

export function buildThreadProgressMessage(info: StatusInfo): string {
  if (info.status === "downloading" && info.progress !== undefined) {
    let msg = `Downloading... ${progressBar(info.progress)}`;
    if (info.eta) msg += ` | ETA: ${formatEta(info.eta)}`;
    return msg;
  }
  if (info.status === "available") {
    return "Download complete! Now available.";
  }
  return `Status: ${info.status}`;
}
