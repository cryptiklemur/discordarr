import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { OverseerrRequest, OverseerrMovie, OverseerrTv } from "../services/overseerr.js";
import {
  CustomId,
  EmbedColor,
  TMDB_IMAGE_BASE,
  TMDB_POSTER_SIZE,
} from "../utils/constants.js";
import { truncate } from "../utils/format.js";

export function buildAdminRequestEmbed(
  request: OverseerrRequest,
  media: OverseerrMovie | OverseerrTv,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const isMovie = request.type === "movie";
  const title = isMovie
    ? (media as OverseerrMovie).title
    : (media as OverseerrTv).name;
  const overview = media.overview ?? "";

  const embed = new EmbedBuilder()
    .setColor(EmbedColor.PENDING)
    .setTitle(`New Request: ${title}`)
    .setDescription(truncate(overview, 512));

  if (media.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${media.posterPath}`);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Type", value: isMovie ? "Movie" : "TV Show", inline: true },
    {
      name: "Requested By",
      value: request.requestedBy.displayName,
      inline: true,
    },
  ];

  if (request.is4k) {
    fields.push({ name: "Quality", value: "4K", inline: true });
  }

  if (!isMovie && request.seasons?.length) {
    const seasonList = request.seasons
      .map((s) => `Season ${s.seasonNumber}`)
      .join(", ");
    fields.push({ name: "Seasons", value: seasonList, inline: false });
  }

  fields.push({ name: "Status", value: "Pending Approval", inline: true });

  embed.addFields(fields);
  embed.setTimestamp(new Date(request.createdAt));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomId.ADMIN_APPROVE}:${request.id}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${CustomId.ADMIN_DENY}:${request.id}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

export function buildApprovedEmbed(
  originalEmbed: EmbedBuilder,
  approverName: string,
): EmbedBuilder {
  return EmbedBuilder.from(originalEmbed.toJSON())
    .setColor(EmbedColor.SUCCESS)
    .setFields(
      ...(originalEmbed.data.fields ?? []).map((f) =>
        f.name === "Status"
          ? { name: "Status", value: `Approved by ${approverName}`, inline: true }
          : f,
      ),
    );
}

export function buildDeniedEmbed(
  originalEmbed: EmbedBuilder,
  denierName: string,
): EmbedBuilder {
  return EmbedBuilder.from(originalEmbed.toJSON())
    .setColor(EmbedColor.DENIED)
    .setFields(
      ...(originalEmbed.data.fields ?? []).map((f) =>
        f.name === "Status"
          ? { name: "Status", value: `Denied by ${denierName}`, inline: true }
          : f,
      ),
    );
}
