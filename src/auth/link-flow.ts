import { randomBytes } from "node:crypto";

interface PendingLink {
  discordId: string;
  state: string;
  createdAt: number;
  resolve: (result: LinkResult) => void;
}

export interface LinkResult {
  success: boolean;
  username?: string;
  error?: string;
}

const pendingLinks = new Map<string, PendingLink>();

const LINK_TIMEOUT_MS = 5 * 60 * 1000;

export function createLinkSession(discordId: string): string {
  for (const [state, link] of pendingLinks) {
    if (link.discordId === discordId) {
      pendingLinks.delete(state);
    }
  }

  const state = randomBytes(32).toString("hex");
  return state;
}

export function registerLinkSession(
  state: string,
  discordId: string,
  resolve: (result: LinkResult) => void,
): void {
  pendingLinks.set(state, {
    discordId,
    state,
    createdAt: Date.now(),
    resolve,
  });

  setTimeout(() => {
    const link = pendingLinks.get(state);
    if (link) {
      pendingLinks.delete(state);
      link.resolve({ success: false, error: "Link session expired" });
    }
  }, LINK_TIMEOUT_MS);
}

export function getPendingLink(state: string): PendingLink | undefined {
  return pendingLinks.get(state);
}

export function completeLinkSession(
  state: string,
  result: LinkResult,
): void {
  const link = pendingLinks.get(state);
  if (link) {
    pendingLinks.delete(state);
    link.resolve(result);
  }
}
