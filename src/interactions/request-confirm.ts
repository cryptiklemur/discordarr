import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canAutoApprove } from "../utils/permissions.js";
import { getLogger } from "../logger.js";
import { createPendingRequest } from "../store/request-store.js";

export default async function handleRequestConfirm(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const btn = interaction as ButtonInteraction;

  await btn.deferUpdate();

  const [mediaType, tmdbIdStr] = context.split(":");
  const tmdbId = parseInt(tmdbIdStr, 10);
  const is4k = btn.customId.startsWith("request-4k");

  if ((mediaType !== "movie" && mediaType !== "tv") || isNaN(tmdbId)) {
    await btn.editReply({ content: "Invalid request.", embeds: [], components: [] });
    return;
  }

  const overseerrUser = await getOverseerrUser(btn.user.id);
  if (!overseerrUser) {
    await btn.editReply({
      content: "Please use `/link` to connect your Overseerr account first.",
      embeds: [],
      components: [],
    });
    return;
  }

  const overseerr = getOverseerr();
  const label = mediaType === "movie" ? "Movie" : "Series";

  try {
    let title = "Unknown";
    let posterPath: string | undefined;

    if (mediaType === "movie") {
      const movie = await overseerr.getMovie(tmdbId);
      title = movie.title;
      posterPath = movie.posterPath;
    } else {
      const tv = await overseerr.getTv(tmdbId);
      title = tv.name;
      posterPath = tv.posterPath;
    }

    if (canAutoApprove(overseerrUser, mediaType)) {
      await overseerr.createRequest({
        mediaType,
        mediaId: tmdbId,
        is4k,
        userId: overseerrUser.id,
      });
    } else {
      createPendingRequest({
        tmdbId,
        mediaType,
        discordUserId: btn.user.id,
        overseerrUserId: overseerrUser.id,
        is4k,
        title,
        posterPath,
      });
    }

    await btn.editReply({ content: `${label} Requested`, embeds: [], components: [] });
  } catch (error) {
    logger.error({ error, mediaType, tmdbId }, "Failed to create request");
    await btn.editReply({
      content: "Failed to create request. Please try again.",
      embeds: [],
      components: [],
    });
  }
}
