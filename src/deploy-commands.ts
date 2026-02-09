import { REST, Routes } from "discord.js";
import { loadConfig } from "./config.js";
import { loadCommands } from "./commands/index.js";
import { getLogger } from "./logger.js";

async function deploy(): Promise<void> {
  const config = loadConfig();
  const logger = getLogger();
  const commands = await loadCommands();
  const commandData = commands.map((c) => c.data);

  const rest = new REST().setToken(config.DISCORD_TOKEN);

  if (config.DISCORD_GUILD_ID) {
    logger.info(
      { guild: config.DISCORD_GUILD_ID, count: commandData.length },
      "Registering guild commands",
    );
    await rest.put(
      Routes.applicationGuildCommands(
        config.DISCORD_CLIENT_ID,
        config.DISCORD_GUILD_ID,
      ),
      { body: commandData },
    );
  } else {
    logger.info(
      { count: commandData.length },
      "Registering global commands",
    );
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {
      body: commandData,
    });
  }

  logger.info("Commands registered successfully");
}

deploy().catch((error) => {
  console.error("Failed to deploy commands:", error);
  process.exit(1);
});
