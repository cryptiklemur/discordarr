import { getOverseerr, Permission, OverseerrUser } from "../services/overseerr.js";

export function hasPermission(user: OverseerrUser, permission: number): boolean {
  if ((user.permissions & Permission.ADMIN) === Permission.ADMIN) {
    return true;
  }
  return (user.permissions & permission) === permission;
}

export async function getOverseerrUser(discordId: string): Promise<OverseerrUser | null> {
  return getOverseerr().getUserByDiscordId(discordId);
}

export function canManageRequests(user: OverseerrUser): boolean {
  return hasPermission(user, Permission.MANAGE_REQUESTS);
}

export function canAutoApprove(user: OverseerrUser, mediaType: "movie" | "tv"): boolean {
  if ((user.permissions & Permission.ADMIN) === Permission.ADMIN) {
    return true;
  }
  if ((user.permissions & Permission.AUTO_APPROVE) === Permission.AUTO_APPROVE) {
    return true;
  }
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
