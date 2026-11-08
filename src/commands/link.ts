import { MessageFlags, SlashCommandBuilder } from "discord.js";
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const existingUser = await getOverseerrUser(interaction.user.id);
    if (existingUser) {
      await interaction.editReply({
        content: `Your account is already linked as **${existingUser.displayName}**.`,
      });
      return;
    }

    const state = createLinkSession(interaction.user.id);
    const overseerrUrl = config.PUBLIC_OVERSEERR_URL ?? config.OVERSEERR_URL;
    const linkUrl = `${overseerrUrl}/login?callbackUrl=${encodeURIComponent(`${config.PUBLIC_URL}/auth/callback?state=${state}`)}`;

    await interaction.editReply({
      content: `Click the link below to connect your Discord account to Overseerr:\n\n[Link Account](${linkUrl})\n\nThis link expires in 5 minutes.`,
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
