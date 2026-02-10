import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getSonarr } from "../services/sonarr.js";
import { getRadarr } from "../services/radarr.js";
import type { RadarrMovie } from "../services/radarr.js";
import type { SonarrSeries } from "../services/sonarr.js";
import { getLogger } from "../logger.js";
import { EmbedColor } from "../utils/constants.js";
import { formatFileSize, formatDuration, truncate } from "../utils/format.js";

function formatMovieLine(movie: RadarrMovie): string {
  if (movie.hasFile && movie.movieFile) {
    const mf = movie.movieFile;
    const parts: string[] = [];

    const quality = mf.quality?.quality?.name;
    if (quality) parts.push(quality);

    const mi = mf.mediaInfo;
    if (mi?.videoCodec) parts.push(mi.videoCodec);
    if (mi?.audioCodec) parts.push(mi.audioCodec);

    if (movie.runtime > 0) parts.push(formatDuration(movie.runtime * 60));
    if (movie.sizeOnDisk > 0) parts.push(formatFileSize(movie.sizeOnDisk));

    const detail = parts.length > 0 ? parts.join(" | ") : "Available";
    return `\u{1F7E2} **${movie.title}** (${movie.year})\n\u2003\u2003${detail}`;
  }

  const status = movie.monitored ? "Monitored — Not yet downloaded" : "Unmonitored";
  const icon = movie.monitored ? "\u{1F7E1}" : "\u26AA";
  return `${icon} **${movie.title}** (${movie.year})\n\u2003\u2003${status}`;
}

function formatSeriesLine(series: SonarrSeries): string {
  const stats = series.statistics;
  const parts: string[] = [];

  if (stats) {
    parts.push(`${stats.episodeFileCount}/${stats.totalEpisodeCount} episodes`);
    if (stats.percentOfEpisodes > 0 && stats.percentOfEpisodes < 100) {
      parts.push(`${Math.round(stats.percentOfEpisodes)}%`);
    }
  } else {
    parts.push(`${series.seasonCount} seasons`);
  }

  if (series.sizeOnDisk > 0) parts.push(formatFileSize(series.sizeOnDisk));

  const hasAllEpisodes = stats && stats.episodeFileCount === stats.totalEpisodeCount && stats.totalEpisodeCount > 0;
  const icon = hasAllEpisodes ? "\u{1F7E2}" : stats && stats.episodeFileCount > 0 ? "\u{1F7E1}" : "\u26AA";

  return `${icon} **${series.title}** (${series.year})\n\u2003\u2003${parts.join(" | ")}`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search the library to see if something is already available")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Title to search for")
        .setRequired(true),
    )
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const query = interaction.options.getString("query", true).trim().toLowerCase();
    const queryWords = query.split(/\s+/);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const [seriesResult, moviesResult] = await Promise.allSettled([
        getSonarr().getSeries(),
        getRadarr().getMovies(),
      ]);

      const allSeries = seriesResult.status === "fulfilled" ? seriesResult.value : [];
      const allMovies = moviesResult.status === "fulfilled" ? moviesResult.value : [];

      if (seriesResult.status === "rejected") {
        logger.error({ error: seriesResult.reason }, "Failed to fetch Sonarr series for search");
      }
      if (moviesResult.status === "rejected") {
        logger.error({ error: moviesResult.reason }, "Failed to fetch Radarr movies for search");
      }

      const matchesMovie = (m: RadarrMovie): boolean => {
        const titles = [m.title, m.sortTitle, m.originalTitle].filter(Boolean).map(t => t!.toLowerCase());
        return titles.some(t => t.includes(query)) || queryWords.every(w => titles.some(t => t.includes(w)));
      };

      const matchesSeries = (s: SonarrSeries): boolean => {
        const titles = [s.title, s.sortTitle].filter(Boolean).map(t => t.toLowerCase());
        return titles.some(t => t.includes(query)) || queryWords.every(w => titles.some(t => t.includes(w)));
      };

      const matchingMovies = allMovies.filter(matchesMovie).slice(0, 10);
      const matchingSeries = allSeries.filter(matchesSeries).slice(0, 10);

      if (matchingSeries.length === 0 && matchingMovies.length === 0) {
        await interaction.editReply(`No results found for **${query}** in the library.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(EmbedColor.INFO)
        .setTitle(`Library Search: "${query}"`);

      const lines: string[] = [];

      if (matchingMovies.length > 0) {
        lines.push("**Movies**");
        for (const movie of matchingMovies) {
          lines.push(formatMovieLine(movie));
        }
      }

      if (matchingSeries.length > 0) {
        if (lines.length > 0) lines.push("");
        lines.push("**TV Shows**");
        for (const series of matchingSeries) {
          lines.push(formatSeriesLine(series));
        }
      }

      embed.setDescription(truncate(lines.join("\n"), 4096));

      const totalResults = matchingMovies.length + matchingSeries.length;
      embed.setFooter({ text: `${totalResults} result${totalResults === 1 ? "" : "s"} found` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error({ error, query }, "Failed to search library");
      await interaction.editReply("Failed to search the library. Please try again.");
    }
  },
};

export default command;
