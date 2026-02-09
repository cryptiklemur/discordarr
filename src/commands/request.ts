import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canRequest4k } from "../utils/permissions.js";
import { loadConfig } from "../config.js";
import { buildSearchResultsEmbed } from "../embeds/search-results.js";
import { getLogger } from "../logger.js";

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
            .setRequired(true),
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
            .setRequired(true),
        ),
    )
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const config = loadConfig();
    const subcommand = interaction.options.getSubcommand() as "movie" | "tv";
    const query = interaction.options.getString("search", true);

    await interaction.deferReply({ ephemeral: true });

    const user = await getOverseerrUser(interaction.user.id);
    if (!user) {
      await interaction.editReply(
        "You need to link your account first. Use `/link` to connect your Discord to Overseerr.",
      );
      return;
    }

    try {
      const results = await getOverseerr().searchMulti(query);
      const { embeds, components } = buildSearchResultsEmbed(
        query,
        results.results.slice(0, config.MAX_SEARCH_RESULTS),
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
