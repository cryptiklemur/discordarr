import { MessageFlags } from "discord.js";
import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canAutoApprove } from "../utils/permissions.js";
import { getLogger } from "../logger.js";
import { createPendingRequest } from "../store/request-store.js";

export default async function handleSeasonSelect(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const selectInteraction = interaction as StringSelectMenuInteraction;

  await selectInteraction.deferReply({ flags: MessageFlags.Ephemeral });

  const [tmdbIdStr, flag] = context.split(":");
  const tmdbId = parseInt(tmdbIdStr, 10);
  const is4k = flag === "4k";

  if (isNaN(tmdbId)) {
    await selectInteraction.editReply("Invalid request.");
    return;
  }

  const overseerrUser = await getOverseerrUser(selectInteraction.user.id);
  if (!overseerrUser) {
    await selectInteraction.editReply(
      "Please use `/link` to connect your Overseerr account first.",
    );
    return;
  }

  try {
    const overseerr = getOverseerr();
    const tvDetails = await overseerr.getTv(tmdbId);

    let selectedSeasons: number[];
    if (selectInteraction.values.includes("all")) {
      selectedSeasons = tvDetails.seasons
        .filter((s) => s.seasonNumber > 0)
        .map((s) => s.seasonNumber);
    } else {
      selectedSeasons = selectInteraction.values.map(Number);
    }

    if (selectedSeasons.length === 0) {
      await selectInteraction.editReply("Please select at least one season.");
      return;
    }

    if (canAutoApprove(overseerrUser, "tv")) {
      await overseerr.createRequest({
        mediaType: "tv",
        mediaId: tmdbId,
        is4k,
        seasons: selectedSeasons,
        userId: overseerrUser.id,
      });
    } else {
      createPendingRequest({
        tmdbId,
        mediaType: "tv",
        discordUserId: selectInteraction.user.id,
        overseerrUserId: overseerrUser.id,
        is4k,
        seasons: selectedSeasons,
        title: tvDetails.name,
        posterPath: tvDetails.posterPath,
      });
    }

    await selectInteraction.editReply("Series Requested");
  } catch (error) {
    logger.error({ error, tmdbId }, "Failed to create TV request");
    await selectInteraction.editReply("Failed to create request. Please try again.");
  }
}
