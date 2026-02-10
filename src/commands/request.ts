import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canRequest4k } from "../utils/permissions.js";
import { loadConfig } from "../config.js";
import { buildSearchResultsEmbed } from "../embeds/search-results.js";
import { getLogger } from "../logger.js";
import { truncate, formatYear } from "../utils/format.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("request")
    .setDescription("Request a movie or TV show")
    .addSubcommand((sub) =>
      sub
        .setName("movie")
        .setDescription("Request a movie")
        .addStringOption((opt) =>
          opt
            .setName("search")
            .setDescription("Movie title to search for")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tv")
        .setDescription("Request a TV show")
        .addStringOption((opt) =>
          opt
            .setName("search")
            .setDescription("TV show title to search for")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .toJSON(),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    if (focused.length < 2) {
      await interaction.respond([]);
      return;
    }

    try {
      const subcommand = interaction.options.getSubcommand() as "movie" | "tv";
      const overseerr = getOverseerr();
      const pages = await Promise.all([
        overseerr.searchMulti(focused, 1),
        overseerr.searchMulti(focused, 2),
        overseerr.searchMulti(focused, 3),
      ]);

      const seen = new Set<number>();
      const filtered = pages
        .flatMap((p) => p.results)
        .filter((r) => {
          if (r.mediaType !== subcommand) return false;
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        })
        .slice(0, 25);

      await interaction.respond(
        filtered.map((r) => {
          const title = r.title || r.name || "Unknown";
          const date = r.releaseDate ?? r.firstAirDate;
          const year = date ? ` (${formatYear(date)})` : "";
          const label = truncate(`${title}${year}`, 100);
          return { name: label, value: title };
        }),
      );
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    const logger = getLogger();
    const config = loadConfig();
    const subcommand = interaction.options.getSubcommand() as "movie" | "tv";
    const query = interaction.options.getString("search", true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = await getOverseerrUser(interaction.user.id);
    if (!user) {
      await interaction.editReply(
        "You need to link your account first. Use `/link` to connect your Discord to Overseerr.",
      );
      return;
    }

    try {
      const allResults = await getOverseerr().searchByType(query, subcommand, config.MAX_SEARCH_RESULTS);

      logger.info(
        { query, subcommand, resultCount: allResults.length, titles: allResults.map((r) => `${r.title || r.name} (${r.id})`) },
        "Search results",
      );

      const { embeds, components } = buildSearchResultsEmbed(
        query,
        allResults,
        subcommand,
      );

      await interaction.editReply({ embeds, components });
    } catch (error) {
      logger.error({ error, query, subcommand }, "Search failed");
      await interaction.editReply("Search failed. Please try again later.");
    }
  },
};

export default command;
