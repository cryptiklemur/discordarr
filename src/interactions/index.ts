import { MessageFlags } from "discord.js";
import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { CustomId } from "../utils/constants.js";
import { getLogger } from "../logger.js";

type InteractionHandler = (
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
) => Promise<void>;

const handlers = new Map<string, InteractionHandler>();

export async function loadInteractions(): Promise<void> {
  const logger = getLogger();

  const modules: [string, () => Promise<{ default: InteractionHandler }>][] = [
    [CustomId.SEARCH_SELECT, () => import("./search-select.js")],
    [CustomId.SEASON_SELECT, () => import("./season-select.js")],
    [CustomId.REQUEST_CONFIRM, () => import("./request-confirm.js")],
    [CustomId.REQUEST_4K, () => import("./request-confirm.js")],
    [CustomId.ADMIN_APPROVE, () => import("./admin-approve.js")],
    [CustomId.ADMIN_DENY, () => import("./admin-deny.js")],
    [CustomId.QUEUE_RETRY, () => import("./queue-retry.js")],
    [CustomId.QUEUE_REMOVE, () => import("./queue-remove.js")],
    [CustomId.LIBRARY_DETAILS, () => import("./library-details.js")],
  ];

  for (const [prefix, load] of modules) {
    try {
      const mod = await load();
      handlers.set(prefix, mod.default);
      logger.debug({ prefix }, "Loaded interaction handler");
    } catch (error) {
      logger.error({ error, prefix }, "Failed to load interaction handler");
    }
  }

  logger.info({ count: handlers.size }, "Interaction handlers loaded");
}

export async function routeInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  const logger = getLogger();
  const customId = interaction.customId;
  const separatorIndex = customId.indexOf(":");
  if (separatorIndex === -1) {
    logger.warn({ customId }, "Invalid customId format");
    return;
  }

  const prefix = customId.slice(0, separatorIndex);
  const context = customId.slice(separatorIndex + 1);

  const handler = handlers.get(prefix);
  if (!handler) {
    logger.warn({ prefix, customId }, "No handler for interaction prefix");
    return;
  }

  try {
    await handler(interaction, context);
  } catch (error) {
    logger.error({ error, customId }, "Interaction handler error");
    const reply = interaction.replied || interaction.deferred
      ? interaction.followUp.bind(interaction)
      : interaction.reply.bind(interaction);
    await reply({
      content: "An error occurred processing this interaction.",
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
}
