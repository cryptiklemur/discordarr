import type { Client, TextChannel } from "discord.js";
import { getOverseerr, MediaStatus, RequestStatus } from "../services/overseerr.js";
import {
  getAllTrackedRequests,
  removeTrackedRequest,
} from "../store/request-store.js";
import { buildAvailableDmEmbed } from "../embeds/notification.js";
import { buildThreadProgressMessage } from "../embeds/request-status.js";
import { getLogger } from "../logger.js";

export async function checkAvailability(client: Client): Promise<void> {
  const logger = getLogger();
  const tracked = getAllTrackedRequests();

  if (tracked.length === 0) return;

  const overseerr = getOverseerr();

  for (const request of tracked) {
    try {
      const overseerrRequest = await overseerr.getRequest(request.requestId);

      if (overseerrRequest.status === RequestStatus.DECLINED) {
        removeTrackedRequest(request.requestId);
        continue;
      }

      const isAvailable =
        overseerrRequest.media.status === MediaStatus.AVAILABLE ||
        (!request.is4k && overseerrRequest.media.status === MediaStatus.AVAILABLE) ||
        (request.is4k && overseerrRequest.media.status4k === MediaStatus.AVAILABLE);

      if (!isAvailable) continue;

      logger.info(
        { requestId: request.requestId, title: request.title },
        "Media now available",
      );

      // Update thread
      if (request.threadId) {
        try {
          const thread = await client.channels.fetch(request.threadId);
          if (thread?.isThread()) {
            await thread.send(
              buildThreadProgressMessage({
                title: request.title,
                status: "available",
              }),
            );
          }
        } catch (error) {
          logger.debug({ error }, "Failed to update availability thread");
        }
      }

      // Update main embed
      if (request.channelId && request.messageId) {
        try {
          const channel = (await client.channels.fetch(request.channelId)) as TextChannel | null;
          if (channel) {
            const message = await channel.messages.fetch(request.messageId);
            const embed = message.embeds[0];
            if (embed) {
              const { EmbedBuilder } = await import("discord.js");
              const updatedEmbed = EmbedBuilder.from(embed)
                .setColor(0x2ecc71)
                .setFields(
                  ...(embed.fields ?? []).map((f) =>
                    f.name === "Status"
                      ? { name: "Status", value: "Available", inline: true }
                      : f,
                  ),
                );
              await message.edit({ embeds: [updatedEmbed], components: [] });
            }
          }
        } catch (error) {
          logger.debug({ error }, "Failed to update availability embed");
        }
      }

      // DM the requester
      try {
        const discordUser = await client.users.fetch(request.discordUserId);
        const dmEmbed = buildAvailableDmEmbed(request.title, request.posterPath);
        await discordUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        logger.debug({ error }, "Failed to send availability DM");
      }

      removeTrackedRequest(request.requestId);
    } catch (error) {
      logger.debug(
        { error, requestId: request.requestId },
        "Failed to check availability",
      );
    }
  }
}
