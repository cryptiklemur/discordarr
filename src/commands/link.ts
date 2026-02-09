import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { loadConfig } from "../config.js";
import { createLinkSession, registerLinkSession } from "../auth/link-flow.js";
import { getOverseerrUser } from "../utils/permissions.js";
import { getLogger } from "../logger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to Overseerr")
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const config = loadConfig();

    const existingUser = await getOverseerrUser(interaction.user.id);
    if (existingUser) {
      await interaction.reply({
        content: `Your account is already linked as **${existingUser.displayName}**.`,
        ephemeral: true,
      });
      return;
    }

    const state = createLinkSession(interaction.user.id);
    const linkUrl = `${config.OVERSEERR_URL}/login?callbackUrl=${encodeURIComponent(`${config.PUBLIC_URL}/auth/callback?state=${state}`)}`;

    await interaction.reply({
      content: `Click the link below to connect your Discord account to Overseerr:\n\n[Link Account](${linkUrl})\n\nThis link expires in 5 minutes.`,
      ephemeral: true,
    });

    registerLinkSession(state, interaction.user.id, async (result) => {
      try {
        if (result.success) {
          await interaction.editReply({
            content: `Account linked! You're connected as **${result.username}**.`,
          });
        } else {
          await interaction.editReply({
            content: `Failed to link account: ${result.error}`,
          });
        }
      } catch (error) {
        logger.error({ error }, "Failed to edit link reply");
      }
    });
  },
};

export default command;
