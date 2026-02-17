import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import type { Client } from "discord.js";
import { getOverseerr, RequestStatus, MediaStatus } from "../services/overseerr.js";
import { getLogger } from "../logger.js";

export interface TrackedRequest {
  requestId: number;
  tmdbId: number;
  tvdbId?: number;
  mediaType: "movie" | "tv";
  discordUserId?: string;
  channelId?: string;
  messageId?: string;
  threadId?: string;
  lastProgress?: number;
  posterPath?: string;
  title: string;
  is4k: boolean;
}

interface DbRow {
  request_id: number;
  tmdb_id: number;
  tvdb_id: number | null;
  media_type: string;
  discord_user_id: string | null;
  channel_id: string | null;
  message_id: string | null;
  thread_id: string | null;
  last_progress: number | null;
  poster_path: string | null;
  title: string;
  is_4k: number;
}

let db: Database;

function migrateNullableDiscordUserId(db: Database): void {
  const info = db.prepare("PRAGMA table_info(tracked_requests)").all() as { name: string; notnull: number }[];
  const col = info.find((c) => c.name === "discord_user_id");
  if (!col || col.notnull === 0) return;

  db.run("BEGIN TRANSACTION");
  try {
    db.run(`CREATE TABLE tracked_requests_new (
      request_id INTEGER PRIMARY KEY,
      tmdb_id INTEGER NOT NULL,
      tvdb_id INTEGER,
      media_type TEXT NOT NULL,
      discord_user_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      thread_id TEXT,
      last_progress REAL,
      poster_path TEXT,
      title TEXT NOT NULL,
      is_4k INTEGER NOT NULL DEFAULT 0
    )`);
    db.run("INSERT INTO tracked_requests_new SELECT * FROM tracked_requests");
    db.run("DROP TABLE tracked_requests");
    db.run("ALTER TABLE tracked_requests_new RENAME TO tracked_requests");

    db.run(`CREATE TABLE pending_requests_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
      discord_user_id TEXT,
      overseerr_user_id INTEGER NOT NULL,
      is_4k INTEGER NOT NULL DEFAULT 0,
      seasons TEXT,
      title TEXT NOT NULL,
      poster_path TEXT,
      channel_id TEXT,
      message_id TEXT,
      thread_id TEXT,
      pending_channel_id TEXT,
      pending_message_id TEXT,
      overseerr_request_id INTEGER
    )`);
    db.run(`INSERT INTO pending_requests_new
      (id, tmdb_id, media_type, discord_user_id, overseerr_user_id, is_4k, seasons, title, poster_path, channel_id, message_id, thread_id, overseerr_request_id)
      SELECT id, tmdb_id, media_type, discord_user_id, overseerr_user_id, is_4k, seasons, title, poster_path, channel_id, message_id, thread_id, overseerr_request_id
      FROM pending_requests`);
    db.run("DROP TABLE pending_requests");
    db.run("ALTER TABLE pending_requests_new RENAME TO pending_requests");

    db.run("COMMIT");
  } catch {
    db.run("ROLLBACK");
  }
}

function getDb(): Database {
  if (db) return db;

  mkdirSync("data", { recursive: true });
  db = new Database("data/discordarr.db");
  db.run("PRAGMA journal_mode=WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS tracked_requests (
      request_id INTEGER PRIMARY KEY,
      tmdb_id INTEGER NOT NULL,
      tvdb_id INTEGER,
      media_type TEXT NOT NULL,
      discord_user_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      thread_id TEXT,
      last_progress REAL,
      poster_path TEXT,
      title TEXT NOT NULL,
      is_4k INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pending_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER NOT NULL,
      media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
      discord_user_id TEXT,
      overseerr_user_id INTEGER NOT NULL,
      is_4k INTEGER NOT NULL DEFAULT 0,
      seasons TEXT,
      title TEXT NOT NULL,
      poster_path TEXT,
      channel_id TEXT,
      message_id TEXT,
      thread_id TEXT,
      pending_channel_id TEXT,
      pending_message_id TEXT,
      overseerr_request_id INTEGER
    )
  `);

  try {
    db.run("ALTER TABLE pending_requests ADD COLUMN overseerr_request_id INTEGER");
  } catch {
    // column already exists
  }

  try {
    db.run("ALTER TABLE tracked_requests ADD COLUMN tvdb_id INTEGER");
  } catch {
    // column already exists
  }

  try {
    db.run("ALTER TABLE pending_requests ADD COLUMN pending_channel_id TEXT");
  } catch {
    // column already exists
  }

  try {
    db.run("ALTER TABLE pending_requests ADD COLUMN pending_message_id TEXT");
  } catch {
    // column already exists
  }

  migrateNullableDiscordUserId(db);

  return db;
}

function rowToRequest(row: DbRow): TrackedRequest {
  return {
    requestId: row.request_id,
    tmdbId: row.tmdb_id,
    tvdbId: row.tvdb_id ?? undefined,
    mediaType: row.media_type as "movie" | "tv",
    discordUserId: row.discord_user_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    threadId: row.thread_id ?? undefined,
    lastProgress: row.last_progress ?? undefined,
    posterPath: row.poster_path ?? undefined,
    title: row.title,
    is4k: row.is_4k === 1,
  };
}

export function trackRequest(request: TrackedRequest): void {
  getDb().run(
    `INSERT OR REPLACE INTO tracked_requests
      (request_id, tmdb_id, tvdb_id, media_type, discord_user_id, channel_id, message_id, thread_id, last_progress, poster_path, title, is_4k)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.requestId,
      request.tmdbId,
      request.tvdbId ?? null,
      request.mediaType,
      request.discordUserId ?? null,
      request.channelId ?? null,
      request.messageId ?? null,
      request.threadId ?? null,
      request.lastProgress ?? null,
      request.posterPath ?? null,
      request.title,
      request.is4k ? 1 : 0,
    ],
  );
}

export function getTrackedRequest(requestId: number): TrackedRequest | undefined {
  const row = getDb().prepare("SELECT * FROM tracked_requests WHERE request_id = ?").get(requestId) as DbRow | null;
  return row ? rowToRequest(row) : undefined;
}

export function removeTrackedRequest(requestId: number): void {
  getDb().run("DELETE FROM tracked_requests WHERE request_id = ?", [requestId]);
}

export function getAllTrackedRequests(): TrackedRequest[] {
  const rows = getDb().prepare("SELECT * FROM tracked_requests").all() as DbRow[];
  return rows.map(rowToRequest);
}

export function getTrackedRequestsByUser(discordUserId: string): TrackedRequest[] {
  const rows = getDb().prepare("SELECT * FROM tracked_requests WHERE discord_user_id = ?").all(discordUserId) as DbRow[];
  return rows.map(rowToRequest);
}

export function updateLastProgress(requestId: number, progress: number): void {
  getDb().run("UPDATE tracked_requests SET last_progress = ? WHERE request_id = ?", [progress, requestId]);
}

export function updateTvdbId(requestId: number, tvdbId: number): void {
  getDb().run("UPDATE tracked_requests SET tvdb_id = ? WHERE request_id = ?", [tvdbId, requestId]);
}

export function getTvRequestsMissingTvdbId(): TrackedRequest[] {
  const rows = getDb().prepare("SELECT * FROM tracked_requests WHERE media_type = 'tv' AND tvdb_id IS NULL").all() as DbRow[];
  return rows.map(rowToRequest);
}

export interface PendingRequest {
  id: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  discordUserId?: string;
  overseerrUserId: number;
  is4k: boolean;
  seasons?: number[];
  title: string;
  posterPath?: string;
  channelId?: string;
  messageId?: string;
  threadId?: string;
  pendingChannelId?: string;
  pendingMessageId?: string;
  overseerrRequestId?: number;
}

interface PendingDbRow {
  id: number;
  tmdb_id: number;
  media_type: string;
  discord_user_id: string | null;
  overseerr_user_id: number;
  is_4k: number;
  seasons: string | null;
  title: string;
  poster_path: string | null;
  channel_id: string | null;
  message_id: string | null;
  thread_id: string | null;
  pending_channel_id: string | null;
  pending_message_id: string | null;
  overseerr_request_id: number | null;
}

function rowToPending(row: PendingDbRow): PendingRequest {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type as "movie" | "tv",
    discordUserId: row.discord_user_id ?? undefined,
    overseerrUserId: row.overseerr_user_id,
    is4k: row.is_4k === 1,
    seasons: row.seasons ? JSON.parse(row.seasons) : undefined,
    title: row.title,
    posterPath: row.poster_path ?? undefined,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    threadId: row.thread_id ?? undefined,
    pendingChannelId: row.pending_channel_id ?? undefined,
    pendingMessageId: row.pending_message_id ?? undefined,
    overseerrRequestId: row.overseerr_request_id ?? undefined,
  };
}

export function createPendingRequest(pending: Omit<PendingRequest, "id">): number {
  const result = getDb().run(
    `INSERT INTO pending_requests
      (tmdb_id, media_type, discord_user_id, overseerr_user_id, is_4k, seasons, title, poster_path, channel_id, message_id, thread_id, pending_channel_id, pending_message_id, overseerr_request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pending.tmdbId,
      pending.mediaType,
      pending.discordUserId ?? null,
      pending.overseerrUserId,
      pending.is4k ? 1 : 0,
      pending.seasons ? JSON.stringify(pending.seasons) : null,
      pending.title,
      pending.posterPath ?? null,
      pending.channelId ?? null,
      pending.messageId ?? null,
      pending.threadId ?? null,
      pending.pendingChannelId ?? null,
      pending.pendingMessageId ?? null,
      pending.overseerrRequestId ?? null,
    ],
  );
  return Number(result.lastInsertRowid);
}

export function getPendingRequest(id: number): PendingRequest | undefined {
  const row = getDb().prepare("SELECT * FROM pending_requests WHERE id = ?").get(id) as PendingDbRow | null;
  return row ? rowToPending(row) : undefined;
}

export function removePendingRequest(id: number): void {
  getDb().run("DELETE FROM pending_requests WHERE id = ?", [id]);
}

export function getPendingByOverseerrRequestId(requestId: number): PendingRequest | undefined {
  const row = getDb().prepare("SELECT * FROM pending_requests WHERE overseerr_request_id = ?").get(requestId) as PendingDbRow | null;
  return row ? rowToPending(row) : undefined;
}

export function getUnpostedPendingRequests(): PendingRequest[] {
  const rows = getDb().prepare("SELECT * FROM pending_requests WHERE message_id IS NULL").all() as PendingDbRow[];
  return rows.map(rowToPending);
}

export function updatePendingMessage(
  id: number,
  channelId: string,
  messageId: string,
  threadId?: string,
  pendingChannelId?: string,
  pendingMessageId?: string,
): void {
  getDb().run(
    "UPDATE pending_requests SET channel_id = ?, message_id = ?, thread_id = ?, pending_channel_id = ?, pending_message_id = ? WHERE id = ?",
    [channelId, messageId, threadId ?? null, pendingChannelId ?? null, pendingMessageId ?? null, id],
  );
}

export async function hydrateRequestStore(_client: Client): Promise<void> {
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

      const existing = getTrackedRequest(request.id);
      if (existing) continue;

      let discordId = request.requestedBy.settings?.discordId;
      if (!discordId) {
        try {
          const notifSettings = await overseerr.getUserNotificationSettings(request.requestedBy.id);
          discordId = notifSettings.discordId;
        } catch {
          // no discord ID available
        }
      }

      let title = "Unknown";
      let posterPath: string | undefined;
      let tvdbId: number | undefined;

      try {
        if (request.type === "movie") {
          const movie = await overseerr.getMovie(request.media.tmdbId);
          title = movie.title;
          posterPath = movie.posterPath;
        } else {
          const tv = await overseerr.getTv(request.media.tmdbId);
          title = tv.name;
          posterPath = tv.posterPath;
          tvdbId = tv.externalIds.tvdbId;
        }
      } catch {
        // skip if we can't fetch media details
      }

      trackRequest({
        requestId: request.id,
        tmdbId: request.media.tmdbId,
        tvdbId,
        mediaType: request.type,
        discordUserId: discordId,
        title,
        posterPath,
        is4k: request.is4k,
      });

      hydrated++;
    }

    const missingTvdb = getTvRequestsMissingTvdbId();
    let backfilled = 0;
    for (const req of missingTvdb) {
      try {
        const tv = await overseerr.getTv(req.tmdbId);
        if (tv.externalIds.tvdbId) {
          updateTvdbId(req.requestId, tv.externalIds.tvdbId);
          backfilled++;
        }
      } catch {
        // skip if lookup fails
      }
    }

    if (backfilled > 0) {
      logger.info({ backfilled }, "Backfilled missing tvdbIds");
    }

    logger.info({ hydrated, total: getAllTrackedRequests().length }, "Request store hydrated");
  } catch (error) {
    logger.error({ error }, "Failed to hydrate request store");
  }
}
