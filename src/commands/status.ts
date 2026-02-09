import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getOverseerr, RequestStatus, MediaStatus } from "../services/overseerr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { EmbedColor } from "../utils/constants.js";
import { getLogger } from "../logger.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check request status")
    .addBooleanOption((opt) =>
      opt
        .setName("all")
        .setDescription("Show all requests (admin only)")
        .setRequired(false),
    )
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const showAll = interaction.options.getBoolean("all") ?? false;

    await interaction.deferReply({ ephemeral: true });

    const user = await getOverseerrUser(interaction.user.id);
    if (!user) {
      await interaction.editReply(
        "You need to link your account first. Use `/link`.",
      );
      return;
    }

    if (showAll && !canManageRequests(user)) {
      await interaction.editReply(
        "You don't have permission to view all requests.",
      );
      return;
    }

    try {
      const params: { take: number; filter: string; sort: string; requestedBy?: number } = {
        take: 20,
        filter: "all",
        sort: "added",
      };

      if (!showAll) {
        params.requestedBy = user.id;
      }

      const response = await getOverseerr().getRequests(params);

      if (response.results.length === 0) {
        await interaction.editReply("No requests found.");
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(EmbedColor.INFO)
        .setTitle(showAll ? "All Recent Requests" : "Your Requests");

      const lines: string[] = [];

      for (const request of response.results) {
        const statusEmoji = getStatusEmoji(request.status, request.media.status);
        const type = request.type === "movie" ? "Movie" : "TV";
        const fourK = request.is4k ? " [4K]" : "";

        let title = "Unknown";
        try {
          if (request.type === "movie") {
            const movie = await getOverseerr().getMovie(request.media.tmdbId);
            title = movie.title;
          } else {
            const tv = await getOverseerr().getTv(request.media.tmdbId);
            title = tv.name;
          }
        } catch {
          // use default
        }

        const statusLabel = getStatusLabel(request.status, request.media.status);
        let line = `${statusEmoji} **${title}** (${type}${fourK}) - ${statusLabel}`;

        if (showAll) {
          line += ` | by ${request.requestedBy.displayName}`;
        }

        lines.push(line);
      }

      embed.setDescription(lines.join("\n"));
      embed.setFooter({
        text: `Showing ${response.results.length} of ${response.pageInfo.results} requests`,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error({ error }, "Failed to fetch requests");
      await interaction.editReply("Failed to fetch requests.");
    }
  },
};

function getStatusEmoji(requestStatus: number, mediaStatus: number): string {
  if (mediaStatus === MediaStatus.AVAILABLE) return "🟢";
  if (requestStatus === RequestStatus.DECLINED) return "🔴";
  if (mediaStatus === MediaStatus.PROCESSING) return "🟡";
  if (requestStatus === RequestStatus.APPROVED) return "🟡";
  return "🟣";
}

function getStatusLabel(requestStatus: number, mediaStatus: number): string {
  if (mediaStatus === MediaStatus.AVAILABLE) return "Available";
  if (requestStatus === RequestStatus.DECLINED) return "Denied";
  if (mediaStatus === MediaStatus.PROCESSING) return "Downloading";
  if (requestStatus === RequestStatus.APPROVED) return "Approved";
  return "Pending";
}

export default command;
