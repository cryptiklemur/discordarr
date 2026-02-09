import type { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";
import { getSonarr } from "../services/sonarr.js";
import { getRadarr } from "../services/radarr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { getLogger } from "../logger.js";

export default async function handleQueueRemove(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  context: string,
): Promise<void> {
  const logger = getLogger();
  const [service, itemId] = context.split(":");
  const id = parseInt(itemId, 10);

  await interaction.deferReply({ ephemeral: true });

  const user = await getOverseerrUser(interaction.user.id);
  if (!user || !canManageRequests(user)) {
    await interaction.editReply("You don't have permission to manage the queue.");
    return;
  }

  try {
    if (service === "sonarr") {
      await getSonarr().removeQueueItem(id);
    } else {
      await getRadarr().removeQueueItem(id);
    }

    await interaction.editReply(`Removed queue item #${id}.`);
    logger.info({ service, itemId: id, user: interaction.user.id }, "Queue item removed");
  } catch (error) {
    logger.error({ error, service, itemId: id }, "Failed to remove queue item");
    await interaction.editReply("Failed to remove from queue.");
  }
}
