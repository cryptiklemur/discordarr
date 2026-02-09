import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { getLogger } from "../logger.js";
import { buildDeniedEmbed } from "../embeds/admin-request.js";
import { buildDeniedDmEmbed } from "../embeds/notification.js";

export default async function handleAdminDeny(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const btn = interaction as ButtonInteraction;
  const requestId = parseInt(context, 10);

  if (isNaN(requestId)) {
    await btn.reply({ content: "Invalid request.", ephemeral: true });
    return;
  }

  await btn.deferUpdate();

  const overseerrUser = await getOverseerrUser(btn.user.id);
  if (!overseerrUser) {
    await btn.followUp({
      content: "Please use `/link` to connect your Overseerr account first.",
      ephemeral: true,
    });
    return;
  }

  if (!canManageRequests(overseerrUser)) {
    await btn.followUp({
      content: "You don't have permission to deny requests.",
      ephemeral: true,
    });
    return;
  }

  try {
    const overseerr = getOverseerr();
    await overseerr.declineRequest(requestId);

    const originalEmbed = btn.message.embeds[0];
    if (originalEmbed) {
      const updatedEmbed = buildDeniedEmbed(
        EmbedBuilder.from(originalEmbed),
        btn.user.username,
      );

      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("approve-disabled")
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("denied-disabled")
          .setLabel("Denied")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),
      );

      await btn.editReply({
        embeds: [updatedEmbed],
        components: [disabledRow],
      });
    }

    const request = await overseerr.getRequest(requestId);
    const requesterDiscordId = request.requestedBy.settings?.discordId;

    if (requesterDiscordId) {
      try {
        let title = "Unknown";
        let posterPath: string | undefined;

        if (request.type === "movie") {
          const movie = await overseerr.getMovie(request.media.tmdbId);
          title = movie.title;
          posterPath = movie.posterPath;
        } else {
          const tv = await overseerr.getTv(request.media.tmdbId);
          title = tv.name;
          posterPath = tv.posterPath;
        }

        const requester = await btn.client.users.fetch(requesterDiscordId);
        const dmEmbed = buildDeniedDmEmbed(title, posterPath);
        await requester.send({ embeds: [dmEmbed] });
      } catch {
        // DMs may be disabled
      }
    }

    if (btn.message.thread) {
      await btn.message.thread
        .send(`Request denied by ${btn.user.username}.`)
        .catch(() => {});
    }

    logger.info({ requestId, admin: btn.user.id }, "Request denied");
  } catch (error) {
    logger.error({ error, requestId }, "Failed to deny request");
    await btn.followUp({
      content: "Failed to deny request.",
      ephemeral: true,
    });
  }
}
