import { z } from "zod";

const configSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional(),
  REQUEST_CHANNEL_ID: z.string().min(1),
  MOVIE_CHANNEL_ID: z.string().optional(),
  TV_CHANNEL_ID: z.string().optional(),
  PENDING_CHANNEL_ID: z.string().optional(),
  OVERSEERR_URL: z.string().url(),
  PUBLIC_OVERSEERR_URL: z.string().url().optional(),
  OVERSEERR_API_KEY: z.string().min(1),
  SONARR_URL: z.string().url(),
  SONARR_API_KEY: z.string().min(1),
  RADARR_URL: z.string().url(),
  RADARR_API_KEY: z.string().min(1),
  PUBLIC_URL: z.string().url(),
  POLL_INTERVAL_SECONDS: z.coerce.number().positive().default(15),
  AVAILABILITY_CHECK_INTERVAL_SECONDS: z.coerce.number().positive().default(120),
  MAX_SEARCH_RESULTS: z.coerce.number().positive().max(25).default(25),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) return config;
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }
  config = result.data;
  return config;
}
