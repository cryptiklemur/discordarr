import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canRequest4k } from "../utils/permissions.js";
import { buildMovieDetailsEmbed, buildTvDetailsEmbed } from "../embeds/media-details.js";
import { getLogger } from "../logger.js";

export default async function handleSearchSelect(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const selectInteraction = interaction as StringSelectMenuInteraction;

  await selectInteraction.deferUpdate();

  const mediaType = context as "movie" | "tv";
  const tmdbId = parseInt(selectInteraction.values[0], 10);

  if (isNaN(tmdbId)) {
    await selectInteraction.followUp({
      content: "Invalid selection. Please try again.",
      ephemeral: true,
    });
    return;
  }

  const overseerrUser = await getOverseerrUser(selectInteraction.user.id);
  if (!overseerrUser) {
    await selectInteraction.followUp({
      content: "Please use `/link` to connect your Overseerr account first.",
      ephemeral: true,
    });
    return;
  }

  try {
    const overseerr = getOverseerr();
    const can4k = canRequest4k(overseerrUser, mediaType);

    if (mediaType === "movie") {
      const movie = await overseerr.getMovie(tmdbId);
      const result = buildMovieDetailsEmbed(movie, can4k);
      await selectInteraction.editReply({
        embeds: result.embeds,
        components: result.components,
      });
    } else {
      const tv = await overseerr.getTv(tmdbId);
      const result = buildTvDetailsEmbed(tv, can4k);
      await selectInteraction.editReply({
        embeds: result.embeds,
        components: result.components,
      });
    }
  } catch (error) {
    logger.error({ error, tmdbId, mediaType }, "Failed to load media details");
    await selectInteraction.followUp({
      content: "Failed to load media details. Please try again.",
      ephemeral: true,
    });
  }
}
