import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ModalSubmitInteraction, TextChannel } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { getLogger } from "../logger.js";
import { buildDeniedEmbed } from "../embeds/admin-request.js";
import { buildDeniedDmEmbed } from "../embeds/notification.js";
import { getPendingRequest, removePendingRequest } from "../store/request-store.js";

export default async function handleDenyReason(
  interaction: ModalSubmitInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const pendingId = parseInt(context, 10);

  if (isNaN(pendingId)) {
    await interaction.reply({ content: "Invalid request.", flags: MessageFlags.Ephemeral });
    return;
  }

  const overseerrUser = await getOverseerrUser(interaction.user.id);
  if (!overseerrUser || !canManageRequests(overseerrUser)) {
    await interaction.reply({
      content: "You don't have permission to deny requests.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  const pending = getPendingRequest(pendingId);
  if (!pending) {
    await interaction.followUp({
      content: "This request is no longer pending.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason = interaction.fields.getTextInputValue("reason").trim() || undefined;

  try {
    if (pending.overseerrRequestId) {
      const overseerr = getOverseerr();
      await overseerr.declineRequest(pending.overseerrRequestId);
    }

    removePendingRequest(pendingId);

    const originalEmbed = interaction.message?.embeds[0];
    if (originalEmbed) {
      const updatedEmbed = buildDeniedEmbed(
        EmbedBuilder.from(originalEmbed),
        interaction.user.username,
        reason,
      );

      await interaction.editReply({
        embeds: [updatedEmbed],
        components: [],
      });

      if (pending.channelId && pending.messageId && pending.pendingMessageId) {
        try {
          const requestChannel = (await interaction.client.channels.fetch(pending.channelId)) as TextChannel | null;
          const requestMessage = requestChannel ? await requestChannel.messages.fetch(pending.messageId) : null;
          if (requestMessage) {
            await requestMessage.edit({
              embeds: [updatedEmbed],
              components: [],
            });
          }
        } catch {
          // request channel message update failed
        }
      }
    }

    if (pending.discordUserId) {
      try {
        const requester = await interaction.client.users.fetch(pending.discordUserId);
        const dmEmbed = buildDeniedDmEmbed(pending.title, pending.posterPath, reason);
        await requester.send({ embeds: [dmEmbed] });
      } catch {
        // DMs may be disabled
      }
    }

    if (pending.threadId) {
      try {
        const thread = await interaction.client.channels.fetch(pending.threadId);
        if (thread?.isThread()) {
          const ping = pending.discordUserId ? `<@${pending.discordUserId}> ` : "";
          const threadMsg = reason
            ? `${ping}Request denied by ${interaction.user.username}. Reason: ${reason}`
            : `${ping}Request denied by ${interaction.user.username}.`;
          await thread.send(threadMsg);
        }
      } catch {
        // thread message failed
      }
    }

    logger.info({ pendingId, reason, admin: interaction.user.id }, "Request denied");
  } catch (error) {
    logger.error({ error, pendingId }, "Failed to deny request");
    await interaction.followUp({
      content: "Failed to deny request.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
