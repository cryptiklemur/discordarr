import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getRadarr } from "../services/radarr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { buildQueueEmbed } from "../embeds/queue.js";
import { buildRadarrCalendarEmbed } from "../embeds/calendar.js";
import { buildMovieLibraryEmbed } from "../embeds/library.js";
import { buildIndexerSearchEmbed } from "../embeds/indexer-results.js";
import { getLogger } from "../logger.js";

const PAGE_SIZE = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("radarr")
    .setDescription("Radarr management commands")
    .addSubcommand((sub) =>
      sub.setName("queue").setDescription("View the download queue"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("calendar")
        .setDescription("View upcoming movies")
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription("Number of days to look ahead")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(90),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("library")
        .setDescription("Browse the movie library")
        .addStringOption((opt) =>
          opt
            .setName("search")
            .setDescription("Search for a movie")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("search")
        .setDescription("Search indexers for a movie")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Movie to search for")
            .setRequired(true),
        ),
    )
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });

    const user = await getOverseerrUser(interaction.user.id);
    if (!user || !canManageRequests(user)) {
      await interaction.editReply(
        "You don't have permission to use Radarr commands.",
      );
      return;
    }

    const radarr = getRadarr();

    try {
      if (subcommand === "queue") {
        const queue = await radarr.getQueue(1, 20);
        const { embeds, components } = buildQueueEmbed(
          queue.records,
          "radarr",
        );
        await interaction.editReply({ embeds, components });
        return;
      }

      if (subcommand === "calendar") {
        const days = interaction.options.getInteger("days") ?? 7;
        const now = new Date();
        const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const movies = await radarr.getCalendar(
          now.toISOString(),
          end.toISOString(),
        );
        const embed = buildRadarrCalendarEmbed(movies, days);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === "library") {
        const search = interaction.options.getString("search");
        let allMovies = await radarr.getMovies();

        if (search) {
          const lower = search.toLowerCase();
          allMovies = allMovies.filter((m) =>
            m.title.toLowerCase().includes(lower),
          );
        }

        allMovies.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

        const totalPages = Math.max(
          1,
          Math.ceil(allMovies.length / PAGE_SIZE),
        );
        const page = 1;
        const pageItems = allMovies.slice(0, PAGE_SIZE);

        const { embeds, components } = buildMovieLibraryEmbed(
          pageItems,
          page,
          totalPages,
        );
        await interaction.editReply({ embeds, components });
        return;
      }

      if (subcommand === "search") {
        const query = interaction.options.getString("query", true);
        const movies = await radarr.lookupMovie(query);

        if (movies.length === 0) {
          await interaction.editReply(`No movies found for "${query}".`);
          return;
        }

        const target = movies[0];
        if (target.id) {
          await radarr.searchMovie([target.id]);
        }

        const embed = buildIndexerSearchEmbed(target.title, "radarr");
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    } catch (error) {
      logger.error({ error, subcommand }, "Radarr command failed");
      await interaction.editReply("An error occurred. Please try again.");
    }
  },
};

export default command;
