import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from "discord.js";
import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { getPendingRequest } from "../store/request-store.js";
import { CustomId } from "../utils/constants.js";

export default async function handleAdminDeny(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const btn = interaction as ButtonInteraction;
  const pendingId = parseInt(context, 10);

  if (isNaN(pendingId)) {
    await btn.reply({ content: "Invalid request.", flags: MessageFlags.Ephemeral });
    return;
  }

  const overseerrUser = await getOverseerrUser(btn.user.id);
  if (!overseerrUser) {
    await btn.reply({
      content: "Please use `/link` to connect your Overseerr account first.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!canManageRequests(overseerrUser)) {
    await btn.reply({
      content: "You don't have permission to deny requests.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pending = getPendingRequest(pendingId);
  if (!pending) {
    await btn.reply({
      content: "This request is no longer pending.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${CustomId.DENY_REASON}:${pendingId}`)
    .setTitle("Deny Request")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason (optional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256)
          .setPlaceholder("Why is this request being denied?"),
      ),
    );

  await btn.showModal(modal);
}
