import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import type { SonarrSeries } from "../services/sonarr.js";
import type { RadarrMovie } from "../services/radarr.js";
import { CustomId, EmbedColor } from "../utils/constants.js";
import { formatFileSize, truncate } from "../utils/format.js";

export interface LibraryEmbedResult {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
}

export function buildSeriesLibraryEmbed(
  series: SonarrSeries[],
  page: number,
  totalPages: number
): LibraryEmbedResult {
  const embed = new EmbedBuilder()
    .setTitle("Sonarr Series Library")
    .setColor(EmbedColor.INFO)
    .setTimestamp()
    .setFooter({ text: `Page ${page} of ${totalPages}` });

  if (series.length === 0) {
    embed.setDescription("No series found");
    return { embeds: [embed], components: [] };
  }

  const lines = series.map((s) => {
    const title = truncate(s.title, 40);
    const seasons = s.seasonCount || s.seasons?.length || 0;
    const downloaded = s.episodeFileCount || 0;
    const total = s.totalEpisodeCount || 0;
    const size = formatFileSize(s.sizeOnDisk || 0);
    return `**${title}** | Seasons: ${seasons} | Episodes: ${downloaded}/${total} | Size: ${size}`;
  });

  embed.setDescription(lines.join("\n") || "No series");

  const options = series.slice(0, 25).map((s) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(truncate(s.title, 100))
      .setValue(s.id.toString())
      .setDescription(`${s.seasonCount || 0} seasons | ${s.episodeFileCount || 0}/${s.totalEpisodeCount || 0} episodes`)
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CustomId.LIBRARY_DETAILS}:sonarr`)
    .setPlaceholder("Select a series to view details")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embeds: [embed], components: [row] };
}

export function buildMovieLibraryEmbed(
  movies: RadarrMovie[],
  page: number,
  totalPages: number
): LibraryEmbedResult {
  const embed = new EmbedBuilder()
    .setTitle("Radarr Movie Library")
    .setColor(EmbedColor.INFO)
    .setTimestamp()
    .setFooter({ text: `Page ${page} of ${totalPages}` });

  if (movies.length === 0) {
    embed.setDescription("No movies found");
    return { embeds: [embed], components: [] };
  }

  const lines = movies.map((m) => {
    const title = truncate(m.title, 40);
    const quality = m.movieFile?.quality.quality.name || "N/A";
    const size = formatFileSize(m.sizeOnDisk || 0);
    const status = m.hasFile ? "Available" : "Missing";
    return `**${title}** (${m.year}) | Quality: ${quality} | Size: ${size} | Status: ${status}`;
  });

  embed.setDescription(lines.join("\n") || "No movies");

  const options = movies.slice(0, 25).map((m) => {
    const quality = m.movieFile?.quality.quality.name || "N/A";
    const status = m.hasFile ? "Available" : "Missing";
    return new StringSelectMenuOptionBuilder()
      .setLabel(truncate(m.title, 100))
      .setValue(m.id.toString())
      .setDescription(`${m.year} | ${quality} | ${status}`);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CustomId.LIBRARY_DETAILS}:radarr`)
    .setPlaceholder("Select a movie to view details")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embeds: [embed], components: [row] };
}
