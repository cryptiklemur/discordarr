import { getLogger } from "../logger.js";
import { loadConfig } from "../config.js";
import { completeLinkSession, getPendingLink } from "./link-flow.js";
import { clearUserCache } from "../utils/permissions.js";

export async function handleAuthCallback(
  url: URL,
): Promise<{ status: number; body: string }> {
  const logger = getLogger();
  const config = loadConfig();
  const state = url.searchParams.get("state");

  if (!state) {
    return { status: 400, body: htmlResponse("Missing state parameter", false) };
  }

  const pending = getPendingLink(state);
  if (!pending) {
    return { status: 400, body: htmlResponse("Invalid or expired link session", false) };
  }

  const authToken = url.searchParams.get("token");
  if (!authToken) {
    return { status: 400, body: htmlResponse("Missing auth token", false) };
  }

  try {
    const meResponse = await fetch(`${config.OVERSEERR_URL}/api/v1/auth/me`, {
      headers: {
        Cookie: `connect.sid=${authToken}`,
        Accept: "application/json",
      },
    });

    if (!meResponse.ok) {
      logger.error({ status: meResponse.status }, "Failed to get Overseerr user");
      completeLinkSession(state, { success: false, error: "Failed to authenticate with Overseerr" });
      return { status: 500, body: htmlResponse("Authentication failed", false) };
    }

    const user = (await meResponse.json()) as {
      id: number;
      displayName: string;
    };

    const updateResponse = await fetch(
      `${config.OVERSEERR_URL}/api/v1/user/${user.id}/settings/main`,
      {
        method: "POST",
        headers: {
          "X-Api-Key": config.OVERSEERR_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ discordId: pending.discordId }),
      },
    );

    if (!updateResponse.ok) {
      logger.error(
        { status: updateResponse.status, userId: user.id },
        "Failed to update Discord ID",
      );
      completeLinkSession(state, { success: false, error: "Failed to update account" });
      return { status: 500, body: htmlResponse("Failed to link account", false) };
    }

    clearUserCache(pending.discordId);

    logger.info(
      { discordId: pending.discordId, overseerrUser: user.displayName },
      "Account linked",
    );

    completeLinkSession(state, {
      success: true,
      username: user.displayName,
    });

    return {
      status: 200,
      body: htmlResponse(`Account linked as ${user.displayName}! You can close this window.`, true),
    };
  } catch (error) {
    logger.error({ error }, "Auth callback error");
    completeLinkSession(state, { success: false, error: "Internal error" });
    return { status: 500, body: htmlResponse("An error occurred", false) };
  }
}

function htmlResponse(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html>
<head><title>Discordarr</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1a1a2e;color:#eee}
.card{background:#16213e;padding:2rem;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.3)}
.success{color:#2ecc71}.error{color:#e74c3c}</style></head>
<body><div class="card"><h1 class="${success ? "success" : "error"}">${success ? "Linked!" : "Error"}</h1><p>${message}</p></div></body></html>`;
}
