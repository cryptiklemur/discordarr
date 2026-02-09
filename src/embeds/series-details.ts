import { EmbedBuilder } from "discord.js";
import type { SonarrSeries } from "../services/sonarr.js";
import { EmbedColor } from "../utils/constants.js";
import { formatFileSize, truncate } from "../utils/format.js";

export function buildSeriesDetailsEmbed(series: SonarrSeries): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(series.title)
    .setColor(EmbedColor.INFO)
    .setTimestamp();

  if (series.overview) {
    embed.setDescription(truncate(series.overview, 400));
  }

  const infoLines: string[] = [];

  if (series.network) {
    infoLines.push(`**Network:** ${series.network}`);
  }

  infoLines.push(`**Year:** ${series.year}`);
  infoLines.push(`**Status:** ${series.status}`);

  if (series.statistics) {
    const downloaded = series.statistics.episodeFileCount || 0;
    const total = series.statistics.totalEpisodeCount || 0;
    infoLines.push(`**Episodes:** ${downloaded}/${total} downloaded`);
  }

  if (infoLines.length > 0) {
    embed.addFields({ name: "Information", value: infoLines.join("\n"), inline: false });
  }

  if (series.seasons && series.seasons.length > 0) {
    const seasonLines = series.seasons
      .filter((s) => s.seasonNumber > 0)
      .map((s) => {
        const stats = s.statistics;
        const downloaded = stats?.episodeFileCount || 0;
        const total = stats?.totalEpisodeCount || 0;
        const size = formatFileSize(stats?.sizeOnDisk || 0);
        const monitored = s.monitored ? "Yes" : "No";
        return `**Season ${s.seasonNumber}:** ${downloaded}/${total} episodes | Monitored: ${monitored} | Size: ${size}`;
      });

    if (seasonLines.length > 0) {
      embed.addFields({
        name: "Seasons",
        value: seasonLines.join("\n"),
        inline: false,
      });
    }
  }

  const techLines: string[] = [];
  techLines.push(`**Total Size:** ${formatFileSize(series.sizeOnDisk || 0)}`);
  techLines.push(`**Quality Profile ID:** ${series.qualityProfileId}`);

  if (series.path) {
    techLines.push(`**Path:** ${truncate(series.path, 100)}`);
  }

  embed.addFields({ name: "Technical", value: techLines.join("\n"), inline: false });

  if (series.images && series.images.length > 0) {
    const fanart = series.images.find((img) => img.coverType === "fanart");
    const poster = series.images.find((img) => img.coverType === "poster");
    const image = fanart || poster;

    if (image) {
      const imageUrl = image.remoteUrl || image.url;
      if (imageUrl) {
        embed.setImage(imageUrl);
      }
    }
  }

  return embed;
}
