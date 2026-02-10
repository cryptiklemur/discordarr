import { loadConfig } from '../config.js';
import { ApiClient } from './http.js';

export interface SonarrQueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: SonarrQueueItem[];
}

export interface SonarrQueueItem {
  id: number;
  seriesId: number;
  episodeId: number;
  seasonNumber: number;
  title: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: { title: string; messages: string[] }[];
  errorMessage?: string;
  size: number;
  sizeleft: number;
  timeleft?: string;
  estimatedCompletionTime?: string;
  downloadId?: string;
  protocol: string;
  quality: { quality: { id: number; name: string } };
  series?: SonarrSeries;
  episode?: SonarrEpisode;
}

export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview?: string;
  network?: string;
  year: number;
  seasonCount: number;
  totalEpisodeCount: number;
  episodeCount: number;
  episodeFileCount: number;
  sizeOnDisk: number;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  tvdbId: number;
  tvRageId?: number;
  imdbId?: string;
  titleSlug: string;
  images?: { coverType: string; url: string; remoteUrl?: string }[];
  seasons?: { seasonNumber: number; monitored: boolean; statistics?: { episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; sizeOnDisk: number; percentOfEpisodes: number } }[];
  statistics?: { seasonCount: number; episodeFileCount: number; episodeCount: number; totalEpisodeCount: number; sizeOnDisk: number; percentOfEpisodes: number };
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate?: string;
  airDateUtc?: string;
  overview?: string;
  hasFile: boolean;
  monitored: boolean;
  episodeFileId?: number;
  episodeFile?: {
    id: number;
    size: number;
    quality: { quality: { id: number; name: string } };
  };
}

export interface SonarrCalendarEntry extends SonarrEpisode {
  series: SonarrSeries;
}

export interface SonarrQualityProfile {
  id: number;
  name: string;
}

class SonarrClient {
  private client: ApiClient;

  constructor() {
    const config = loadConfig();
    this.client = new ApiClient({
      baseUrl: config.SONARR_URL,
      apiKey: config.SONARR_API_KEY,
    });
  }

  async getQueue(page?: number, pageSize?: number): Promise<SonarrQueueResponse> {
    return this.client.get<SonarrQueueResponse>('/api/v3/queue', {
      page: page ?? 1,
      pageSize: pageSize ?? 20,
      includeUnknownSeriesItems: false,
      includeSeries: true,
      includeEpisode: true,
    });
  }

  async retryQueueItem(id: number): Promise<void> {
    await this.client.post(`/api/v3/queue/grab/${id}`);
  }

  async removeQueueItem(id: number, removeFromClient?: boolean, blocklist?: boolean): Promise<void> {
    await this.client.delete(`/api/v3/queue/${id}`, {
      removeFromClient: removeFromClient ?? true,
      blocklist: blocklist ?? false,
    });
  }

  async getSeries(): Promise<SonarrSeries[]> {
    return this.client.get<SonarrSeries[]>('/api/v3/series');
  }

  async getSeriesById(id: number): Promise<SonarrSeries> {
    return this.client.get<SonarrSeries>(`/api/v3/series/${id}`);
  }

  async getSeriesByTvdbId(tvdbId: number): Promise<SonarrSeries | undefined> {
    const results = await this.client.get<SonarrSeries[]>('/api/v3/series', { tvdbId });
    return results[0];
  }

  async lookupSeries(term: string): Promise<SonarrSeries[]> {
    return this.client.get<SonarrSeries[]>('/api/v3/series/lookup', { term });
  }

  async getEpisodes(seriesId: number, seasonNumber?: number): Promise<SonarrEpisode[]> {
    const params: Record<string, string | number> = { seriesId };
    if (seasonNumber !== undefined) {
      params.seasonNumber = seasonNumber;
    }
    return this.client.get<SonarrEpisode[]>('/api/v3/episode', params);
  }

  async getCalendar(startDate: string, endDate: string): Promise<SonarrCalendarEntry[]> {
    return this.client.get<SonarrCalendarEntry[]>('/api/v3/calendar', {
      start: startDate,
      end: endDate,
      includeSeries: true,
      includeEpisodeFile: true,
    });
  }

  async searchEpisodes(episodeIds: number[]): Promise<void> {
    await this.client.post('/api/v3/command', {
      name: 'EpisodeSearch',
      episodeIds,
    });
  }

  async searchSeason(seriesId: number, seasonNumber: number): Promise<void> {
    await this.client.post('/api/v3/command', {
      name: 'SeasonSearch',
      seriesId,
      seasonNumber,
    });
  }

  async searchSeries(seriesId: number): Promise<void> {
    await this.client.post('/api/v3/command', {
      name: 'SeriesSearch',
      seriesId,
    });
  }

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.client.get<SonarrQualityProfile[]>('/api/v3/qualityprofile');
  }
}

let sonarrInstance: SonarrClient | null = null;

export function getSonarr(): SonarrClient {
  if (!sonarrInstance) {
    sonarrInstance = new SonarrClient();
  }
  return sonarrInstance;
}
