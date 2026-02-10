import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { getOverseerr, RequestStatus, MediaStatus, type OverseerrRequest } from "../services/overseerr.js";
import { getOverseerrUser, canManageRequests } from "../utils/permissions.js";
import { EmbedColor } from "../utils/constants.js";
import { getLogger } from "../logger.js";

type StatusFilter = "active" | "pending" | "approved" | "downloading" | "awaiting" | "available" | "denied" | "all";

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
    .addStringOption((opt) =>
      opt
        .setName("filter")
        .setDescription("Filter by status (default: active)")
        .setRequired(false)
        .addChoices(
          { name: "Active (non-available)", value: "active" },
          { name: "Pending Approval", value: "pending" },
          { name: "Approved / Awaiting Release", value: "approved" },
          { name: "Downloading", value: "downloading" },
          { name: "Awaiting Release", value: "awaiting" },
          { name: "Available", value: "available" },
          { name: "Denied", value: "denied" },
          { name: "All", value: "all" },
        ),
    )
    .toJSON(),

  async execute(interaction) {
    const logger = getLogger();
    const showAll = interaction.options.getBoolean("all") ?? false;
    const filter = (interaction.options.getString("filter") ?? "active") as StatusFilter;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      const overseerrFilter = filter === "denied" ? "declined"
        : filter === "pending" ? "pending"
        : filter === "approved" || filter === "awaiting" || filter === "downloading" ? "approved"
        : filter === "available" ? "available"
        : "all";

      const params: { take: number; filter: string; sort: string; requestedBy?: number } = {
        take: 50,
        filter: overseerrFilter,
        sort: "added",
      };

      if (!showAll) {
        params.requestedBy = user.id;
      }

      const response = await getOverseerr().getRequests(params);

      const enriched: { request: OverseerrRequest; title: string; releaseDate?: string }[] = [];

      for (const request of response.results) {
        let title = "Unknown";
        let releaseDate: string | undefined;

        try {
          if (request.type === "movie") {
            const movie = await getOverseerr().getMovie(request.media.tmdbId);
            title = movie.title;
            releaseDate = movie.releaseDate;
          } else {
            const tv = await getOverseerr().getTv(request.media.tmdbId);
            title = tv.name;
            releaseDate = tv.firstAirDate;
          }
        } catch {
          // use defaults
        }

        enriched.push({ request, title, releaseDate });
      }

      const filtered = enriched.filter((e) => {
        const resolved = resolveStatus(e.request, e.releaseDate);
        if (filter === "active") return resolved !== "Available";
        if (filter === "downloading") return resolved === "Downloading";
        if (filter === "awaiting") return resolved === "Awaiting Release";
        if (filter === "approved") return resolved === "Awaiting Release" || resolved === "Downloading" || resolved === "Approved";
        return true;
      });

      if (filtered.length === 0) {
        await interaction.editReply("No requests found matching that filter.");
        return;
      }

      const lines: string[] = [];
      for (const { request, title, releaseDate } of filtered.slice(0, 20)) {
        const status = resolveStatus(request, releaseDate);
        const emoji = statusEmoji(status);
        const type = request.type === "movie" ? "Movie" : "TV";
        const fourK = request.is4k ? " [4K]" : "";

        let line = `${emoji} **${title}** (${type}${fourK}) - ${status}`;
        if (showAll) {
          line += ` | by ${request.requestedBy.displayName}`;
        }
        lines.push(line);
      }

      const filterLabel = filter === "active" ? "Active" : filter.charAt(0).toUpperCase() + filter.slice(1);
      const embed = new EmbedBuilder()
        .setColor(EmbedColor.INFO)
        .setTitle(showAll ? `All Requests (${filterLabel})` : `Your Requests (${filterLabel})`)
        .setDescription(lines.join("\n"))
        .setFooter({
          text: `Showing ${Math.min(filtered.length, 20)} of ${filtered.length} requests`,
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error({ error }, "Failed to fetch requests");
      await interaction.editReply("Failed to fetch requests.");
    }
  },
};

type ResolvedStatus = "Pending" | "Approved" | "Awaiting Release" | "Downloading" | "Partially Available" | "Available" | "Denied";

function resolveStatus(request: OverseerrRequest, releaseDate?: string): ResolvedStatus {
  const mediaStatus = request.media.status;
  const requestStatus = request.status;

  if (mediaStatus === MediaStatus.AVAILABLE) return "Available";
  if (mediaStatus === MediaStatus.PARTIALLY_AVAILABLE) return "Partially Available";
  if (requestStatus === RequestStatus.DECLINED) return "Denied";

  const isReleased = releaseDate ? new Date(releaseDate) <= new Date() : true;

  if (mediaStatus === MediaStatus.PROCESSING) {
    return isReleased ? "Downloading" : "Awaiting Release";
  }
  if (requestStatus === RequestStatus.APPROVED) {
    return isReleased ? "Approved" : "Awaiting Release";
  }

  return "Pending";
}

function statusEmoji(status: ResolvedStatus): string {
  switch (status) {
    case "Available": return "🟢";
    case "Partially Available": return "🟢";
    case "Denied": return "🔴";
    case "Downloading": return "🟡";
    case "Awaiting Release": return "🔵";
    case "Approved": return "🟡";
    case "Pending": return "🟣";
  }
}

export default command;
