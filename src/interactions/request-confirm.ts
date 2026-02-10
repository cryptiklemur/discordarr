import { ChannelType, MessageFlags } from "discord.js";
import type { ButtonInteraction, StringSelectMenuInteraction, TextChannel } from "discord.js";
import { getOverseerr } from "../services/overseerr.js";
import type { OverseerrMovie, OverseerrTv } from "../services/overseerr.js";
import { getOverseerrUser, canAutoApprove } from "../utils/permissions.js";
import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import { buildAdminRequestEmbed } from "../embeds/admin-request.js";
import { buildSubmittedDmEmbed } from "../embeds/notification.js";
import { trackRequest } from "../store/request-store.js";

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
    await btn.followUp({ content: "Invalid request.", flags: MessageFlags.Ephemeral });
    return;
  }

  const overseerrUser = await getOverseerrUser(btn.user.id);
  if (!overseerrUser) {
    await btn.followUp({
      content: "Please use `/link` to connect your Overseerr account first.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const overseerr = getOverseerr();

  try {
    const request = await overseerr.createRequest({
      mediaType,
      mediaId: tmdbId,
      is4k,
    });

    let title = "Unknown";
    let posterPath: string | undefined;
    let media: OverseerrMovie | OverseerrTv;

    if (mediaType === "movie") {
      const movie = await overseerr.getMovie(tmdbId);
      title = movie.title;
      posterPath = movie.posterPath;
      media = movie;
    } else {
      const tv = await overseerr.getTv(tmdbId);
      title = tv.name;
      posterPath = tv.posterPath;
      media = tv;
    }

    const autoApprove = canAutoApprove(overseerrUser, mediaType);

    if (autoApprove) {
      await overseerr.approveRequest(request.id);
      await btn.followUp({
        content: `Your request for **${title}** has been auto-approved!${is4k ? " (4K)" : ""}`,
        flags: MessageFlags.Ephemeral,
      });

      trackRequest({
        requestId: request.id,
        tmdbId,
        mediaType,
        discordUserId: btn.user.id,
        title,
        posterPath,
        is4k,
      });

      return;
    }

    const config = loadConfig();
    const channelId =
      mediaType === "movie"
        ? config.MOVIE_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID
        : config.TV_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID;

    const channel = (await btn.client.channels.fetch(channelId)) as TextChannel | null;
    if (!channel) {
      await btn.followUp({
        content: "Request created but could not post to request channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const adminEmbed = buildAdminRequestEmbed(request, media);
    const adminMessage = await channel.send({
      embeds: adminEmbed.embeds,
      components: adminEmbed.components,
    });

    let threadId: string | undefined;
    try {
      const thread = await adminMessage.startThread({
        name: `${title} - Request`,
        autoArchiveDuration: 1440,
      });
      threadId = thread.id;
    } catch (error) {
      logger.debug({ error }, "Failed to create thread");
    }

    trackRequest({
      requestId: request.id,
      tmdbId,
      mediaType,
      discordUserId: btn.user.id,
      channelId: channel.id,
      messageId: adminMessage.id,
      threadId,
      title,
      posterPath,
      is4k,
    });

    await btn.followUp({
      content: `Your request for **${title}** has been submitted!${is4k ? " (4K)" : ""}`,
      flags: MessageFlags.Ephemeral,
    });

    try {
      const dmEmbed = buildSubmittedDmEmbed(title, posterPath);
      await btn.user.send({ embeds: [dmEmbed] });
    } catch {
      // DMs may be disabled
    }
  } catch (error) {
    logger.error({ error, mediaType, tmdbId }, "Failed to create request");
    await btn.followUp({
      content: "Failed to create request. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
