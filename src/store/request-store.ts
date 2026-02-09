import type { Client } from "discord.js";
import { getOverseerr, RequestStatus, MediaStatus } from "../services/overseerr.js";
import { getLogger } from "../logger.js";

export interface TrackedRequest {
  requestId: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  discordUserId: string;
  channelId?: string;
  messageId?: string;
  threadId?: string;
  lastProgress?: number;
  lastThreadMessageId?: string;
  posterPath?: string;
  title: string;
  is4k: boolean;
}

const trackedRequests = new Map<number, TrackedRequest>();

export function trackRequest(request: TrackedRequest): void {
  trackedRequests.set(request.requestId, request);
}

export function getTrackedRequest(requestId: number): TrackedRequest | undefined {
  return trackedRequests.get(requestId);
}

export function removeTrackedRequest(requestId: number): void {
  trackedRequests.delete(requestId);
}

export function getAllTrackedRequests(): TrackedRequest[] {
  return [...trackedRequests.values()];
}

export function getTrackedRequestsByUser(discordUserId: string): TrackedRequest[] {
  const results: TrackedRequest[] = [];
  for (const request of trackedRequests.values()) {
    if (request.discordUserId === discordUserId) {
      results.push(request);
    }
  }
  return results;
}

export async function hydrateRequestStore(client: Client): Promise<void> {
  const logger = getLogger();
  const overseerr = getOverseerr();

  try {
    const response = await overseerr.getRequests({
      take: 100,
      filter: "all",
      sort: "added",
    });

    let hydrated = 0;
    for (const request of response.results) {
      if (
        request.status === RequestStatus.DECLINED ||
        request.media.status === MediaStatus.AVAILABLE
      ) {
        continue;
      }

      const discordId = request.requestedBy.settings?.discordId;
      if (!discordId) continue;

      let title = "Unknown";
      let posterPath: string | undefined;

      try {
        if (request.type === "movie") {
          const movie = await overseerr.getMovie(request.media.tmdbId);
          title = movie.title;
          posterPath = movie.posterPath;
        } else {
          const tv = await overseerr.getTv(request.media.tmdbId);
          title = tv.name;
          posterPath = tv.posterPath;
        }
      } catch {
        // skip if we can't fetch media details
      }

      trackRequest({
        requestId: request.id,
        tmdbId: request.media.tmdbId,
        mediaType: request.type,
        discordUserId: discordId,
        title,
        posterPath,
        is4k: request.is4k,
      });

      hydrated++;
    }

    logger.info({ hydrated }, "Request store hydrated from Overseerr");
  } catch (error) {
    logger.error({ error }, "Failed to hydrate request store");
  }
}
