import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getSonarr } from "../services/sonarr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { buildQueueEmbed } from "../embeds/queue.js";
import { buildSonarrCalendarEmbed } from "../embeds/calendar.js";
import { buildSeriesLibraryEmbed } from "../embeds/library.js";
import { buildIndexerSearchEmbed } from "../embeds/indexer-results.js";
import { getLogger } from "../logger.js";

const PAGE_SIZE = 10;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sonarr")
    .setDescription("Sonarr management commands")
    .addSubcommand((sub) =>
      sub.setName("queue").setDescription("View the download queue"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("calendar")
        .setDescription("View upcoming episodes")
        .addIntegerOption((opt) =>
          opt
            .setName("days")
            .setDescription("Number of days to look ahead")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(30),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("library")
        .setDescription("Browse the series library")
        .addStringOption((opt) =>
          opt
            .setName("search")
            .setDescription("Search for a series")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("search")
        .setDescription("Search indexers for a series")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Series to search for")
            .setRequired(true),
        ),
    )
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = await getOverseerrUser(interaction.user.id);
    if (!user || !canManageRequests(user)) {
      await interaction.editReply(
        "You don't have permission to use Sonarr commands.",
      );
      return;
    }

    const sonarr = getSonarr();

    try {
      if (subcommand === "queue") {
        const queue = await sonarr.getQueue(1, 20);
        const { embeds, components } = buildQueueEmbed(
          queue.records,
          "sonarr",
        );
        await interaction.editReply({ embeds, components });
        return;
      }

      if (subcommand === "calendar") {
        const days = interaction.options.getInteger("days") ?? 7;
        const now = new Date();
        const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const episodes = await sonarr.getCalendar(
          now.toISOString(),
          end.toISOString(),
        );
        const embed = buildSonarrCalendarEmbed(episodes, days);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === "library") {
        const search = interaction.options.getString("search");
        let allSeries = await sonarr.getSeries();

        if (search) {
          const lower = search.toLowerCase();
          allSeries = allSeries.filter((s) =>
            s.title.toLowerCase().includes(lower),
          );
        }

        allSeries.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

        const totalPages = Math.max(1, Math.ceil(allSeries.length / PAGE_SIZE));
        const page = 1;
        const pageItems = allSeries.slice(0, PAGE_SIZE);

        const { embeds, components } = buildSeriesLibraryEmbed(
          pageItems,
          page,
          totalPages,
        );
        await interaction.editReply({ embeds, components });
        return;
      }

      if (subcommand === "search") {
        const query = interaction.options.getString("query", true);
        const series = await sonarr.lookupSeries(query);

        if (series.length === 0) {
          await interaction.editReply(`No series found for "${query}".`);
          return;
        }

        const target = series[0];
        if (target.id) {
          await sonarr.searchSeries(target.id);
        }

        const embed = buildIndexerSearchEmbed(target.title, "sonarr");
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    } catch (error) {
      logger.error({ error, subcommand }, "Sonarr command failed");
      await interaction.editReply("An error occurred. Please try again.");
    }
  },
};

export default command;
