import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { OverseerrRequest, OverseerrMovie, OverseerrTv } from "../services/overseerr.js";
import {
  CustomId,
  EmbedColor,
  TMDB_IMAGE_BASE,
  TMDB_POSTER_SIZE,
} from "../utils/constants.js";
import { truncate } from "../utils/format.js";

interface RequestEmbedOptions {
  title: string;
  overview: string;
  posterPath?: string;
  mediaType: "movie" | "tv";
  requestedBy: string;
  is4k: boolean;
  seasons?: { seasonNumber: number }[];
  createdAt?: Date;
}

function buildBaseEmbed(opts: RequestEmbedOptions): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`New Request: ${opts.title}`)
    .setDescription(truncate(opts.overview, 512));

  if (opts.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${opts.posterPath}`);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Type", value: opts.mediaType === "movie" ? "Movie" : "TV Show", inline: true },
    { name: "Requested By", value: opts.requestedBy, inline: true },
  ];

  if (opts.is4k) {
    fields.push({ name: "Quality", value: "4K", inline: true });
  }

  if (opts.mediaType === "tv" && opts.seasons?.length) {
    const seasonList = opts.seasons.map((s) => `Season ${s.seasonNumber}`).join(", ");
    fields.push({ name: "Seasons", value: seasonList, inline: false });
  }

  embed.addFields(fields);
  embed.setTimestamp(opts.createdAt ?? new Date());

  return embed;
}

export function buildPendingRequestEmbed(
  pendingId: number,
  media: OverseerrMovie | OverseerrTv,
  requestedBy: string,
  mediaType: "movie" | "tv",
  is4k: boolean,
  seasons?: number[],
  createdAt?: Date,
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const title = mediaType === "movie" ? (media as OverseerrMovie).title : (media as OverseerrTv).name;

  const embed = buildBaseEmbed({
    title,
    overview: media.overview ?? "",
    posterPath: media.posterPath,
    mediaType,
    requestedBy,
    is4k,
    seasons: seasons?.map((n) => ({ seasonNumber: n })),
    createdAt,
  });

  embed.setColor(EmbedColor.PENDING);
  embed.addFields({ name: "Status", value: "Pending Approval", inline: true });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CustomId.ADMIN_APPROVE}:${pendingId}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${CustomId.ADMIN_DENY}:${pendingId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

export function buildAutoApprovedEmbed(
  media: OverseerrMovie | OverseerrTv,
  requestedBy: string,
  mediaType: "movie" | "tv",
  is4k: boolean,
  seasons?: { seasonNumber: number }[],
  createdAt?: Date,
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const title = mediaType === "movie" ? (media as OverseerrMovie).title : (media as OverseerrTv).name;

  const embed = buildBaseEmbed({
    title,
    overview: media.overview ?? "",
    posterPath: media.posterPath,
    mediaType,
    requestedBy,
    is4k,
    seasons,
    createdAt,
  });

  embed.setColor(EmbedColor.SUCCESS);
  embed.addFields({ name: "Status", value: "Auto-Approved", inline: true });

  return { embeds: [embed], components: [] };
}

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

  const embed = buildBaseEmbed({
    title,
    overview: media.overview ?? "",
    posterPath: media.posterPath,
    mediaType: request.type,
    requestedBy: request.requestedBy.displayName,
    is4k: request.is4k,
    seasons: request.seasons,
  });

  embed.setColor(EmbedColor.PENDING);
  embed.addFields({ name: "Status", value: "Pending Approval", inline: true });
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
  reason?: string,
): EmbedBuilder {
  const fields = (originalEmbed.data.fields ?? []).map((f) =>
    f.name === "Status"
      ? { name: "Status", value: `Denied by ${denierName}`, inline: true }
      : f,
  );

  if (reason) {
    fields.push({ name: "Reason", value: reason, inline: false });
  }

  return EmbedBuilder.from(originalEmbed.toJSON())
    .setColor(EmbedColor.DENIED)
    .setFields(...fields);
}
