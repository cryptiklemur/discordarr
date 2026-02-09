import { loadConfig } from '../config.js';
import { ApiClient } from './http.js';

export interface RadarrQueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: RadarrQueueItem[];
}

export interface RadarrQueueItem {
  id: number;
  movieId: number;
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
  movie?: RadarrMovie;
}

export interface RadarrMovie {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview?: string;
  year: number;
  runtime: number;
  sizeOnDisk: number;
  path?: string;
  qualityProfileId: number;
  monitored: boolean;
  tmdbId: number;
  imdbId?: string;
  titleSlug: string;
  images?: { coverType: string; url: string; remoteUrl?: string }[];
  hasFile: boolean;
  movieFile?: {
    id: number;
    size: number;
    quality: { quality: { id: number; name: string } };
    mediaInfo?: {
      videoCodec?: string;
      audioCodec?: string;
      resolution?: string;
    };
    relativePath?: string;
  };
  ratings?: { imdb?: { value: number; votes: number }; tmdb?: { value: number; votes: number } };
  certification?: string;
  genres?: string[];
  studio?: string;
  inCinemas?: string;
  physicalRelease?: string;
  digitalRelease?: string;
}

export interface RadarrQualityProfile {
  id: number;
  name: string;
}

class RadarrClient {
  private client: ApiClient;

  constructor() {
    const config = loadConfig();
    this.client = new ApiClient({
      baseUrl: config.RADARR_URL,
      apiKey: config.RADARR_API_KEY
    });
  }

  async getQueue(page?: number, pageSize?: number): Promise<RadarrQueueResponse> {
    return this.client.get<RadarrQueueResponse>('/api/v3/queue', {
      page: page ?? 1,
      pageSize: pageSize ?? 20,
      includeUnknownMovieItems: false,
      includeMovie: true
    });
  }

  async retryQueueItem(id: number): Promise<void> {
    await this.client.post(`/api/v3/queue/grab/${id}`);
  }

  async removeQueueItem(id: number, removeFromClient?: boolean, blocklist?: boolean): Promise<void> {
    await this.client.delete(`/api/v3/queue/${id}`, {
      removeFromClient: removeFromClient ?? true,
      blocklist: blocklist ?? false
    });
  }

  async getMovies(): Promise<RadarrMovie[]> {
    return this.client.get<RadarrMovie[]>('/api/v3/movie');
  }

  async getMovieById(id: number): Promise<RadarrMovie> {
    return this.client.get<RadarrMovie>(`/api/v3/movie/${id}`);
  }

  async lookupMovie(term: string): Promise<RadarrMovie[]> {
    return this.client.get<RadarrMovie[]>('/api/v3/movie/lookup', { term });
  }

  async getMovieByTmdbId(tmdbId: number): Promise<RadarrMovie> {
    return this.client.get<RadarrMovie>('/api/v3/movie/lookup/tmdb', { tmdbId });
  }

  async getCalendar(startDate: string, endDate: string): Promise<RadarrMovie[]> {
    return this.client.get<RadarrMovie[]>('/api/v3/calendar', {
      start: startDate,
      end: endDate,
      includeUnmonitored: false
    });
  }

  async searchMovie(movieIds: number[]): Promise<void> {
    await this.client.post('/api/v3/command', {
      name: 'MoviesSearch',
      movieIds
    });
  }

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    return this.client.get<RadarrQualityProfile[]>('/api/v3/qualityprofile');
  }
}

let radarrInstance: RadarrClient | null = null;

export function getRadarr(): RadarrClient {
  if (!radarrInstance) {
    radarrInstance = new RadarrClient();
  }
  return radarrInstance;
}
