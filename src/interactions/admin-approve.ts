import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { getLogger } from "../logger.js";
import { buildApprovedEmbed } from "../embeds/admin-request.js";
import { buildApprovedDmEmbed } from "../embeds/notification.js";
import { getPendingRequest, removePendingRequest, trackRequest } from "../store/request-store.js";

export default async function handleAdminApprove(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const btn = interaction as ButtonInteraction;
  const pendingId = parseInt(context, 10);

  if (isNaN(pendingId)) {
    await btn.reply({ content: "Invalid request.", flags: MessageFlags.Ephemeral });
    return;
  }

  await btn.deferUpdate();

  const overseerrUser = await getOverseerrUser(btn.user.id);
  if (!overseerrUser) {
    await btn.followUp({
      content: "Please use `/link` to connect your Overseerr account first.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!canManageRequests(overseerrUser)) {
    await btn.followUp({
      content: "You don't have permission to approve requests.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pending = getPendingRequest(pendingId);
  if (!pending) {
    await btn.followUp({
      content: "This request is no longer pending.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const overseerr = getOverseerr();
    let requestId: number;

    if (pending.overseerrRequestId) {
      await overseerr.approveRequest(pending.overseerrRequestId);
      requestId = pending.overseerrRequestId;
    } else {
      const request = await overseerr.createRequest({
        mediaType: pending.mediaType,
        mediaId: pending.tmdbId,
        is4k: pending.is4k,
        seasons: pending.seasons,
        userId: pending.overseerrUserId,
      });
      requestId = request.id;
    }

    let tvdbId: number | undefined;
    if (pending.mediaType === "tv") {
      try {
        const tv = await overseerr.getTv(pending.tmdbId);
        tvdbId = tv.externalIds.tvdbId;
      } catch {
        // tvdbId lookup failed, queue matching will be skipped
      }
    }

    trackRequest({
      requestId,
      tmdbId: pending.tmdbId,
      tvdbId,
      mediaType: pending.mediaType,
      discordUserId: pending.discordUserId,
      channelId: pending.channelId,
      messageId: pending.messageId,
      threadId: pending.threadId,
      title: pending.title,
      posterPath: pending.posterPath,
      is4k: pending.is4k,
    });

    removePendingRequest(pendingId);

    const originalEmbed = btn.message.embeds[0];
    if (originalEmbed) {
      const updatedEmbed = buildApprovedEmbed(
        EmbedBuilder.from(originalEmbed),
        btn.user.username,
      );

      await btn.editReply({
        embeds: [updatedEmbed],
        components: [],
      });
    }

    if (pending.discordUserId) {
      try {
        const requester = await btn.client.users.fetch(pending.discordUserId);
        const dmEmbed = buildApprovedDmEmbed(pending.title, pending.posterPath);
        await requester.send({ embeds: [dmEmbed] });
      } catch {
        // DMs may be disabled
      }
    }

    if (btn.message.thread) {
      const ping = pending.discordUserId ? `<@${pending.discordUserId}> ` : "";
      await btn.message.thread
        .send(`${ping}Request approved by ${btn.user.username}.`)
        .catch(() => {});
    }

    logger.info({ pendingId, requestId, admin: btn.user.id }, "Request approved");
  } catch (error) {
    logger.error({ error, pendingId }, "Failed to approve request");
    await btn.followUp({
      content: "Failed to approve request.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
