import {
  Collection,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { getLogger } from "../logger.js";

export interface Command {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

const commands = new Collection<string, Command>();

export async function loadCommands(): Promise<Collection<string, Command>> {
  if (commands.size > 0) return commands;
  const logger = getLogger();

  const modules = [
    () => import("./request.js"),
    () => import("./search.js"),
    () => import("./status.js"),
    () => import("./link.js"),
    () => import("./sonarr.js"),
    () => import("./radarr.js"),
  ];

  for (const load of modules) {
    try {
      const mod = await load();
      const command = mod.default as Command;
      commands.set(command.data.name, command);
      logger.debug({ command: command.data.name }, "Loaded command");
    } catch (error) {
      logger.error({ error }, "Failed to load command");
    }
  }

  logger.info({ count: commands.size }, "Commands loaded");
  return commands;
}

export function getCommands(): Collection<string, Command> {
  return commands;
}
