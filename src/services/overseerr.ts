import { loadConfig } from "../config.js";
import { getLogger } from "../logger.js";
import { ApiClient } from "./http.js";

export interface OverseerrSearchResult {
  id: number;
  mediaType: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  originalTitle?: string;
  originalName?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  mediaInfo?: OverseerrMediaInfo;
}

export interface OverseerrMediaInfo {
  id: number;
  tmdbId: number;
  status: number;
  status4k: number;
  requests?: OverseerrRequest[];
}

export const MediaStatus = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
} as const;

export interface OverseerrMovie {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate: string;
  runtime: number;
  voteAverage: number;
  genres: { id: number; name: string }[];
  mediaInfo?: OverseerrMediaInfo;
  externalIds: { imdbId?: string };
}

export interface OverseerrTv {
  id: number;
  name: string;
  originalName: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  firstAirDate: string;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  voteAverage: number;
  genres: { id: number; name: string }[];
  seasons: OverseerrSeason[];
  mediaInfo?: OverseerrMediaInfo;
  externalIds: { imdbId?: string; tvdbId?: number };
}

export interface OverseerrSeason {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  overview?: string;
}

export interface OverseerrRequest {
  id: number;
  status: number;
  type: "movie" | "tv";
  is4k: boolean;
  createdAt: string;
  updatedAt: string;
  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    status: number;
    status4k: number;
    mediaType: "movie" | "tv";
    externalServiceId?: number;
    externalServiceId4k?: number;
  };
  requestedBy: OverseerrUser;
  modifiedBy?: OverseerrUser;
  seasons?: { id: number; seasonNumber: number; status: number }[];
}

export const RequestStatus = {
  PENDING: 1,
  APPROVED: 2,
  DECLINED: 3,
} as const;

export interface OverseerrUser {
  id: number;
  email: string;
  displayName: string;
  avatar?: string;
  permissions: number;
  userType: number;
  settings?: {
    discordId?: string;
    region?: string;
    locale?: string;
  };
}

export const Permission = {
  ADMIN: 2,
  MANAGE_USERS: 8,
  MANAGE_REQUESTS: 16,
  REQUEST: 32,
  VOTE: 64,
  AUTO_APPROVE: 128,
  AUTO_APPROVE_MOVIE: 256,
  AUTO_APPROVE_TV: 512,
  REQUEST_4K: 1024,
  REQUEST_4K_MOVIE: 2048,
  REQUEST_4K_TV: 4096,
  AUTO_APPROVE_4K: 32768,
  AUTO_APPROVE_4K_MOVIE: 65536,
  AUTO_APPROVE_4K_TV: 131072,
} as const;

export interface ServiceSettings {
  id: number;
  name: string;
  is4k: boolean;
  isDefault: boolean;
}

interface SearchResponse {
  results: OverseerrSearchResult[];
  totalPages: number;
  totalResults: number;
}

interface RequestsResponse {
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
  results: OverseerrRequest[];
}

interface UsersResponse {
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
  results: OverseerrUser[];
}

interface CreateRequestBody {
  mediaType: "movie" | "tv";
  mediaId: number;
  is4k?: boolean;
  seasons?: number[];
  userId?: number;
}

class OverseerrService {
  private readonly client: ApiClient;

  constructor() {
    const config = loadConfig();
    this.client = new ApiClient({
      baseUrl: config.OVERSEERR_URL,
      apiKey: config.OVERSEERR_API_KEY,
    });
  }

  async searchMulti(query: string, page: number = 1): Promise<SearchResponse> {
    return this.client.get<SearchResponse>("/api/v1/search", {
      query,
      page,
      language: "en",
    });
  }

  async searchByType(
    query: string,
    mediaType: "movie" | "tv",
    limit: number = 25,
  ): Promise<OverseerrSearchResult[]> {
    const results: OverseerrSearchResult[] = [];
    const seen = new Set<number>();
    const maxPages = 5;

    for (let page = 1; page <= maxPages; page++) {
      const response = await this.client.get<SearchResponse>("/api/v1/search", {
        query,
        page,
        language: "en",
      });

      for (const r of response.results) {
        if (r.mediaType === mediaType && !seen.has(r.id)) {
          seen.add(r.id);
          results.push(r);
          if (results.length >= limit) return results;
        }
      }

      if (page >= response.totalPages) break;
    }

    return results;
  }

  async getMovie(tmdbId: number): Promise<OverseerrMovie> {
    return this.client.get<OverseerrMovie>(`/api/v1/movie/${tmdbId}`);
  }

  async getTv(tmdbId: number): Promise<OverseerrTv> {
    return this.client.get<OverseerrTv>(`/api/v1/tv/${tmdbId}`);
  }

  async createRequest(body: CreateRequestBody): Promise<OverseerrRequest> {
    return this.client.post<OverseerrRequest>("/api/v1/request", body);
  }

  async approveRequest(requestId: number): Promise<OverseerrRequest> {
    return this.client.post<OverseerrRequest>(
      `/api/v1/request/${requestId}/approve`,
    );
  }

  async declineRequest(requestId: number): Promise<OverseerrRequest> {
    return this.client.post<OverseerrRequest>(
      `/api/v1/request/${requestId}/decline`,
    );
  }

  async getRequest(requestId: number): Promise<OverseerrRequest> {
    return this.client.get<OverseerrRequest>(`/api/v1/request/${requestId}`);
  }

  async getRequests(params?: {
    skip?: number;
    take?: number;
    filter?: string;
    sort?: string;
    requestedBy?: number;
  }): Promise<RequestsResponse> {
    return this.client.get<RequestsResponse>(
      "/api/v1/request",
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  async getUserByDiscordId(discordId: string): Promise<OverseerrUser | null> {
    const logger = getLogger();
    let page = 1;
    const take = 100;

    while (true) {
      const skip = (page - 1) * take;
      const response = await this.client.get<UsersResponse>("/api/v1/user", {
        take,
        skip,
      });

      const checks = response.results.map(async (user) => {
        try {
          const notifSettings = await this.client.get<{ discordId?: string }>(
            `/api/v1/user/${user.id}/settings/notifications`,
          );
          if (notifSettings.discordId === discordId) {
            user.settings = { ...user.settings, discordId };
            return user;
          }
        } catch {
          // skip
        }
        return null;
      });

      const found = (await Promise.all(checks)).find((u) => u !== null);
      if (found) return found;

      if (response.results.length === 0) break;
      if (page >= response.pageInfo.pages) break;
      page++;
    }

    logger.warn({ discordId }, "No Overseerr user found with matching discordId");
    return null;
  }

  async getUser(userId: number): Promise<OverseerrUser> {
    return this.client.get<OverseerrUser>(`/api/v1/user/${userId}`);
  }

  async updateUser(
    userId: number,
    data: Partial<OverseerrUser>,
  ): Promise<OverseerrUser> {
    return this.client.put<OverseerrUser>(`/api/v1/user/${userId}`, data);
  }

  async getUserSettings(userId: number): Promise<Record<string, unknown>> {
    return this.client.get<Record<string, unknown>>(
      `/api/v1/user/${userId}/settings/main`,
    );
  }

  async updateUserSettings(
    userId: number,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.client.post<Record<string, unknown>>(
      `/api/v1/user/${userId}/settings/main`,
      data,
    );
  }

  async getUserNotificationSettings(userId: number): Promise<{ discordId?: string }> {
    return this.client.get<{ discordId?: string }>(
      `/api/v1/user/${userId}/settings/notifications`,
    );
  }

  async getSonarrSettings(): Promise<ServiceSettings[]> {
    return this.client.get<ServiceSettings[]>("/api/v1/settings/sonarr");
  }

  async getRadarrSettings(): Promise<ServiceSettings[]> {
    return this.client.get<ServiceSettings[]>("/api/v1/settings/radarr");
  }

  async has4kService(mediaType: "movie" | "tv"): Promise<boolean> {
    if (this._4kCache.has(mediaType)) return this._4kCache.get(mediaType)!;

    try {
      const settings = mediaType === "movie"
        ? await this.getRadarrSettings()
        : await this.getSonarrSettings();
      const has4k = settings.some((s) => s.is4k);
      this._4kCache.set(mediaType, has4k);
      return has4k;
    } catch {
      return false;
    }
  }

  private readonly _4kCache = new Map<string, boolean>();
}

let instance: OverseerrService | null = null;

export function getOverseerr(): OverseerrService {
  if (!instance) {
    instance = new OverseerrService();
  }
  return instance;
}
