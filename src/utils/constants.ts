export const CustomId = {
  SEARCH_SELECT: "search-select",
  SEASON_SELECT: "season-select",
  REQUEST_CONFIRM: "request-confirm",
  REQUEST_4K: "request-4k",
  ADMIN_APPROVE: "admin-approve",
  ADMIN_DENY: "admin-deny",
  DENY_REASON: "deny-reason",
  QUEUE_RETRY: "queue-retry",
  QUEUE_REMOVE: "queue-remove",
  LIBRARY_DETAILS: "library-details",
} as const;

export const EmbedColor = {
  INFO: 0x3498db,
  SUCCESS: 0x2ecc71,
  WARNING: 0xf39c12,
  ERROR: 0xe74c3c,
  PENDING: 0x9b59b6,
  DOWNLOADING: 0xe67e22,
  AVAILABLE: 0x2ecc71,
  DENIED: 0xe74c3c,
} as const;

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const TMDB_POSTER_SIZE = "w500";
export const TMDB_BACKDROP_SIZE = "w780";
