# Discordarr

Discord bot for media request management via Overseerr, Sonarr, and Radarr.

## Tech Stack

- Runtime: Bun
- Language: TypeScript, ESM (all imports use `.js` extensions)
- Discord: discord.js v14
- Config: zod env validation
- Logging: pino (`logger.info({obj}, "message")` — object first, message second)
- Database: SQLite via `bun:sqlite`
- Deployment: Docker (oven/bun alpine)

## Commands

### Deploy Slash Commands

Whenever you add, remove, or rename a slash command (or change its options/subcommands), run:

```sh
bun src/deploy-commands.ts
```

This registers the commands with Discord. Without this step, new/changed commands won't appear for users.

## Key Patterns

- Lazy singletons for API clients: `getOverseerr()`, `getSonarr()`, `getRadarr()`
- `getLogger()` takes no arguments
- CustomId format: `handler:context` for persistent button routing
- Interaction handlers use union type: `ButtonInteraction | StringSelectMenuInteraction`
- Deferred request creation: non-auto-approve users' requests are stored in SQLite `pending_requests` table, only created in Overseerr when an admin clicks Approve
- Overseerr admin API key auto-approves everything — that's why we defer creation for non-auto-approve users
