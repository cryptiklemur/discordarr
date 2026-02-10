import { MessageFlags } from "discord.js";
import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getSonarr } from "../services/sonarr.js";
import { getRadarr } from "../services/radarr.js";
import { buildSeriesDetailsEmbed } from "../embeds/series-details.js";
import { buildMovieDetailsEmbed as buildRadarrMovieDetailsEmbed } from "../embeds/movie-details.js";
import { getLogger } from "../logger.js";

export default async function handleLibraryDetails(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const selectInteraction = interaction as StringSelectMenuInteraction;
  const service = context;
  const selectedId = parseInt(selectInteraction.values[0], 10);

  await interaction.deferUpdate();

  try {
    if (service === "sonarr") {
      const series = await getSonarr().getSeriesById(selectedId);
      const embed = buildSeriesDetailsEmbed(series);
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      const movie = await getRadarr().getMovieById(selectedId);
      const embed = buildRadarrMovieDetailsEmbed(movie);
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  } catch (error) {
    logger.error({ error, service, selectedId }, "Failed to get library details");
    await interaction.followUp({
      content: "Failed to load details.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
