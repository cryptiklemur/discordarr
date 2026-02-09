import type { ButtonInteraction, StringSelectMenuInteraction, TextChannel } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canAutoApprove } from "../utils/permissions.js";
import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import { buildAdminRequestEmbed } from "../embeds/admin-request.js";
import { buildSubmittedDmEmbed } from "../embeds/notification.js";
import { trackRequest } from "../store/request-store.js";

export default async function handleSeasonSelect(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const selectInteraction = interaction as StringSelectMenuInteraction;

  await selectInteraction.deferReply({ ephemeral: true });

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

    const request = await overseerr.createRequest({
      mediaType: "tv",
      mediaId: tmdbId,
      is4k,
      seasons: selectedSeasons,
    });

    const autoApprove = canAutoApprove(overseerrUser, "tv");

    if (autoApprove) {
      await overseerr.approveRequest(request.id);
      await selectInteraction.editReply(
        `Your request for **${tvDetails.name}** has been auto-approved!${is4k ? " (4K)" : ""}`,
      );

      trackRequest({
        requestId: request.id,
        tmdbId,
        mediaType: "tv",
        discordUserId: selectInteraction.user.id,
        title: tvDetails.name,
        posterPath: tvDetails.posterPath,
        is4k,
      });

      return;
    }

    const config = loadConfig();
    const channelId = config.TV_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID;
    const channel = (await selectInteraction.client.channels.fetch(channelId)) as TextChannel | null;

    if (!channel) {
      await selectInteraction.editReply(
        "Request created but could not post to request channel.",
      );
      return;
    }

    const adminEmbed = buildAdminRequestEmbed(request, tvDetails);
    const adminMessage = await channel.send({
      embeds: adminEmbed.embeds,
      components: adminEmbed.components,
    });

    let threadId: string | undefined;
    try {
      const thread = await adminMessage.startThread({
        name: `${tvDetails.name} - Request`,
        autoArchiveDuration: 1440,
      });
      threadId = thread.id;
    } catch (error) {
      logger.debug({ error }, "Failed to create thread");
    }

    trackRequest({
      requestId: request.id,
      tmdbId,
      mediaType: "tv",
      discordUserId: selectInteraction.user.id,
      channelId: channel.id,
      messageId: adminMessage.id,
      threadId,
      title: tvDetails.name,
      posterPath: tvDetails.posterPath,
      is4k,
    });

    await selectInteraction.editReply(
      `Your request for **${tvDetails.name}** has been submitted!${is4k ? " (4K)" : ""}`,
    );

    try {
      const dmEmbed = buildSubmittedDmEmbed(tvDetails.name, tvDetails.posterPath);
      await selectInteraction.user.send({ embeds: [dmEmbed] });
    } catch {
      // DMs may be disabled
    }
  } catch (error) {
    logger.error({ error, tmdbId }, "Failed to create TV request");
    await selectInteraction.editReply("Failed to create request. Please try again.");
  }
}
