import { Events } from "discord.js";
import { loadConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { createClient } from "./client.js";
import { loadCommands, getCommands } from "./commands/index.js";
import { loadInteractions, routeInteraction } from "./interactions/index.js";
import { startAuthServer, stopAuthServer } from "./auth/server.js";
import { startPolling, stopPolling } from "./polling/poll-manager.js";
import { hydrateRequestStore } from "./store/request-store.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = getLogger();

  logger.info("Starting Discordarr...");

  const client = createClient();

  await loadCommands();
  await loadInteractions();

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ user: readyClient.user.tag }, "Discord bot ready");

    startAuthServer(client);
    await hydrateRequestStore(client);
    startPolling(client);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = getCommands().get(interaction.commandName);
      if (!command) {
        logger.warn(
          { command: interaction.commandName },
          "Unknown command received",
        );
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(
          { error, command: interaction.commandName },
          "Command execution error",
        );
        const reply = interaction.replied || interaction.deferred
          ? interaction.followUp.bind(interaction)
          : interaction.reply.bind(interaction);
        await reply({
          content: "An error occurred while executing this command.",
          ephemeral: true,
        }).catch(() => {});
      }
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      await routeInteraction(interaction);
    }
  });

  const shutdown = async () => {
    logger.info("Shutting down...");
    stopPolling();
    stopAuthServer();
    client.destroy();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(config.DISCORD_TOKEN);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
