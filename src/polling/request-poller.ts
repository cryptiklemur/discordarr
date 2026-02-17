import type { Client, TextChannel } from "discord.js";
import { getOverseerr, RequestStatus, MediaStatus } from "../services/overseerr.js";
import type { OverseerrMovie, OverseerrTv } from "../services/overseerr.js";
import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import {
  getTrackedRequest,
  getPendingByOverseerrRequestId,
  trackRequest,
  createPendingRequest,
  getUnpostedPendingRequests,
  updatePendingMessage,
} from "../store/request-store.js";
import { buildAutoApprovedEmbed, buildPendingRequestEmbed } from "../embeds/admin-request.js";

export async function pollNewRequests(client: Client): Promise<void> {
  const logger = getLogger();

  await pollOverseerrRequests(client, logger);
  await pollUnpostedPendingRequests(client, logger);
}

async function pollOverseerrRequests(client: Client, logger: ReturnType<typeof getLogger>): Promise<void> {
  const overseerr = getOverseerr();

  try {
    const response = await overseerr.getRequests({
      take: 50,
      filter: "all",
      sort: "added",
    });

    for (const request of response.results) {
      if (
        request.status === RequestStatus.DECLINED ||
        request.media.status === MediaStatus.AVAILABLE
      ) {
        continue;
      }

      const existing = getTrackedRequest(request.id);
      if (existing?.messageId) continue;
      if (getPendingByOverseerrRequestId(request.id)) continue;

      let resolvedDiscordId = request.requestedBy.settings?.discordId;
      if (!resolvedDiscordId) {
        try {
          const notifSettings = await overseerr.getUserNotificationSettings(request.requestedBy.id);
          resolvedDiscordId = notifSettings.discordId;
        } catch {
          // no discord ID available — still post the request
        }
      }

      let title = "Unknown";
      let posterPath: string | undefined;
      let tvdbId: number | undefined;
      let media: OverseerrMovie | OverseerrTv;

      try {
        if (request.type === "movie") {
          const movie = await overseerr.getMovie(request.media.tmdbId);
          title = movie.title;
          posterPath = movie.posterPath;
          media = movie;
        } else {
          const tv = await overseerr.getTv(request.media.tmdbId);
          title = tv.name;
          posterPath = tv.posterPath;
          tvdbId = tv.externalIds.tvdbId;
          media = tv;
        }
      } catch {
        continue;
      }

      const config = loadConfig();
      const channelId =
        request.type === "movie"
          ? config.MOVIE_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID
          : config.TV_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID;

      const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
      if (!channel) continue;

      if (request.status === RequestStatus.APPROVED) {
        const autoEmbed = buildAutoApprovedEmbed(
          media,
          request.requestedBy.displayName,
          request.type,
          request.is4k,
          request.seasons?.map((s) => ({ seasonNumber: s.seasonNumber })),
          new Date(request.createdAt),
        );
        const message = await channel.send({
          embeds: autoEmbed.embeds,
          components: autoEmbed.components,
        });

        let threadId: string | undefined;
        try {
          const thread = await message.startThread({
            name: `${title} - Request`,
            autoArchiveDuration: 1440,
          });
          threadId = thread.id;
        } catch {
          // thread creation may fail
        }

        trackRequest({
          requestId: request.id,
          tmdbId: request.media.tmdbId,
          tvdbId,
          mediaType: request.type,
          discordUserId: resolvedDiscordId,
          channelId: channel.id,
          messageId: message.id,
          threadId,
          title,
          posterPath,
          is4k: request.is4k,
        });

        logger.info({ requestId: request.id, title }, "Posted approved request");
      } else if (request.status === RequestStatus.PENDING) {
        const pendingId = createPendingRequest({
          tmdbId: request.media.tmdbId,
          mediaType: request.type,
          discordUserId: resolvedDiscordId,
          overseerrUserId: request.requestedBy.id,
          is4k: request.is4k,
          seasons: request.seasons?.map((s) => s.seasonNumber),
          title,
          posterPath,
          overseerrRequestId: request.id,
        });

        logger.info({ requestId: request.id, pendingId, title }, "Created pending record for Overseerr request");
      }
    }
  } catch (error) {
    logger.error({ error }, "Failed to poll Overseerr requests");
  }
}

async function pollUnpostedPendingRequests(client: Client, logger: ReturnType<typeof getLogger>): Promise<void> {
  const overseerr = getOverseerr();

  try {
    const unposted = getUnpostedPendingRequests();
    if (unposted.length === 0) return;

    for (const pending of unposted) {
      let media: OverseerrMovie | OverseerrTv;

      try {
        if (pending.mediaType === "movie") {
          media = await overseerr.getMovie(pending.tmdbId);
        } else {
          media = await overseerr.getTv(pending.tmdbId);
        }
      } catch {
        logger.warn({ pendingId: pending.id, tmdbId: pending.tmdbId }, "Failed to fetch media for pending request");
        continue;
      }

      let displayName: string;
      if (pending.discordUserId) {
        try {
          const user = await client.users.fetch(pending.discordUserId);
          displayName = user.displayName;
        } catch {
          displayName = pending.discordUserId;
        }
      } else {
        try {
          const overseerrUser = await overseerr.getUser(pending.overseerrUserId);
          displayName = overseerrUser.displayName;
        } catch {
          displayName = "Unknown User";
        }
      }

      const config = loadConfig();
      const channelId = config.PENDING_CHANNEL_ID
        ?? (pending.mediaType === "movie"
          ? config.MOVIE_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID
          : config.TV_CHANNEL_ID ?? config.REQUEST_CHANNEL_ID);

      const channel = (await client.channels.fetch(channelId)) as TextChannel | null;
      if (!channel) continue;

      const pendingEmbed = buildPendingRequestEmbed(
        pending.id,
        media,
        displayName,
        pending.mediaType,
        pending.is4k,
        pending.seasons,
      );
      const message = await channel.send({
        embeds: pendingEmbed.embeds,
        components: pendingEmbed.components,
      });

      let threadId: string | undefined;
      try {
        const thread = await message.startThread({
          name: `${pending.title} - Request`,
          autoArchiveDuration: 1440,
        });
        threadId = thread.id;
      } catch {
        // thread creation may fail
      }

      updatePendingMessage(pending.id, channel.id, message.id, threadId);

      logger.info({ pendingId: pending.id, title: pending.title }, "Posted pending request from bot");
    }
  } catch (error) {
    logger.error({ error }, "Failed to poll unposted pending requests");
  }
}
