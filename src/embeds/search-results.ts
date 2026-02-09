import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuOptionBuilder,
} from "discord.js";
import type { OverseerrSearchResult } from "../services/overseerr.js";
import { CustomId, EmbedColor, TMDB_IMAGE_BASE, TMDB_POSTER_SIZE } from "../utils/constants.js";
import { truncate, formatYear } from "../utils/format.js";

export function buildSearchResultsEmbed(
  query: string,
  results: OverseerrSearchResult[],
  mediaType: "movie" | "tv",
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder>[] } {
  const filtered = results.filter((r) => r.mediaType === mediaType);

  if (filtered.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(EmbedColor.WARNING)
          .setTitle("No Results")
          .setDescription(`No ${mediaType === "movie" ? "movies" : "TV shows"} found for "${query}".`),
      ],
      components: [],
    };
  }

  const embed = new EmbedBuilder()
    .setColor(EmbedColor.INFO)
    .setTitle(`Search Results for "${query}"`)
    .setDescription(`Select a ${mediaType === "movie" ? "movie" : "TV show"} from the dropdown below.`);

  const firstResult = filtered[0];
  if (firstResult.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${firstResult.posterPath}`);
  }

  const options = filtered.map((result) => {
    const title = result.title ?? result.name ?? "Unknown";
    const year =
      mediaType === "movie"
        ? formatYear(result.releaseDate)
        : formatYear(result.firstAirDate);
    const label = truncate(`${title} (${year})`, 100);
    const description = truncate(result.overview ?? "No description", 100);

    return {
      label,
      description,
      value: `${result.id}`,
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CustomId.SEARCH_SELECT}:${mediaType}`)
    .setPlaceholder("Select a result...")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embeds: [embed], components: [row] };
}
