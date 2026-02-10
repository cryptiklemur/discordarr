import { getOverseerr, Permission, OverseerrUser } from "../services/overseerr.js";
import { getLogger } from "../logger.js";

const userCache = new Map<string, { user: OverseerrUser | null; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const NEGATIVE_CACHE_TTL = 30 * 1000;

export function hasPermission(user: OverseerrUser, permission: number): boolean {
  if ((user.permissions & Permission.ADMIN) === Permission.ADMIN) {
    return true;
  }
  return (user.permissions & permission) === permission;
}

export async function getOverseerrUser(discordId: string): Promise<OverseerrUser | null> {
  const cached = userCache.get(discordId);
  if (cached && Date.now() < cached.expires) {
    return cached.user;
  }

  try {
    const user = await getOverseerr().getUserByDiscordId(discordId);
    const ttl = user ? CACHE_TTL : NEGATIVE_CACHE_TTL;
    userCache.set(discordId, { user, expires: Date.now() + ttl });
    return user;
  } catch (error) {
    getLogger().error({ error, discordId }, "Failed to look up Overseerr user");
    return null;
  }
}

export function clearUserCache(discordId?: string): void {
  if (discordId) {
    userCache.delete(discordId);
  } else {
    userCache.clear();
  }
}

export function canManageRequests(user: OverseerrUser): boolean {
  return hasPermission(user, Permission.MANAGE_REQUESTS);
}

export function canAutoApprove(user: OverseerrUser, mediaType: "movie" | "tv"): boolean {
  if ((user.permissions & Permission.ADMIN) === Permission.ADMIN) return true;
  if ((user.permissions & Permission.AUTO_APPROVE) === Permission.AUTO_APPROVE) return true;
  if (mediaType === "movie") {
    return (user.permissions & Permission.AUTO_APPROVE_MOVIE) === Permission.AUTO_APPROVE_MOVIE;
  }
  return (user.permissions & Permission.AUTO_APPROVE_TV) === Permission.AUTO_APPROVE_TV;
}

export function canRequest4k(user: OverseerrUser, mediaType: "movie" | "tv"): boolean {
  if ((user.permissions & Permission.ADMIN) === Permission.ADMIN) {
    return true;
  }
  if ((user.permissions & Permission.REQUEST_4K) === Permission.REQUEST_4K) {
    return true;
  }
  if (mediaType === "movie") {
    return (user.permissions & Permission.REQUEST_4K_MOVIE) === Permission.REQUEST_4K_MOVIE;
  }
  return (user.permissions & Permission.REQUEST_4K_TV) === Permission.REQUEST_4K_TV;
}
