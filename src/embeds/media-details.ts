import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import type { OverseerrMovie, OverseerrTv } from "../services/overseerr.js";
import { MediaStatus } from "../services/overseerr.js";
import {
  CustomId,
  EmbedColor,
  TMDB_IMAGE_BASE,
  TMDB_POSTER_SIZE,
  TMDB_BACKDROP_SIZE,
} from "../utils/constants.js";
import { truncate } from "../utils/format.js";

export function buildMovieDetailsEmbed(
  movie: OverseerrMovie,
  can4k: boolean,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const status = movie.mediaInfo?.status ?? MediaStatus.UNKNOWN;
  const alreadyRequested =
    status === MediaStatus.PENDING || status === MediaStatus.PROCESSING;
  const alreadyAvailable = status === MediaStatus.AVAILABLE;

  const embed = new EmbedBuilder()
    .setColor(alreadyAvailable ? EmbedColor.AVAILABLE : EmbedColor.INFO)
    .setTitle(movie.title)
    .setURL(`https://www.themoviedb.org/movie/${movie.id}`)
    .setDescription(truncate(movie.overview, 1024));

  if (movie.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${movie.posterPath}`);
  }
  if (movie.backdropPath) {
    embed.setImage(`${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZE}${movie.backdropPath}`);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (movie.releaseDate) {
    fields.push({
      name: "Release Date",
      value: new Date(movie.releaseDate).toLocaleDateString(),
      inline: true,
    });
  }
  if (movie.runtime) {
    fields.push({
      name: "Runtime",
      value: `${movie.runtime} min`,
      inline: true,
    });
  }
  if (movie.voteAverage) {
    fields.push({
      name: "Rating",
      value: `${movie.voteAverage.toFixed(1)}/10`,
      inline: true,
    });
  }
  if (movie.genres?.length) {
    fields.push({
      name: "Genres",
      value: movie.genres.map((g) => g.name).join(", "),
      inline: false,
    });
  }
  if (alreadyAvailable) {
    fields.push({ name: "Status", value: "Available", inline: true });
  } else if (alreadyRequested) {
    fields.push({ name: "Status", value: "Already Requested", inline: true });
  }

  embed.addFields(fields);

  const row = new ActionRowBuilder<ButtonBuilder>();

  if (!alreadyAvailable && !alreadyRequested) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CustomId.REQUEST_CONFIRM}:movie:${movie.id}`)
        .setLabel("Request")
        .setStyle(ButtonStyle.Primary),
    );

    if (can4k) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CustomId.REQUEST_4K}:movie:${movie.id}`)
          .setLabel("Request 4K")
          .setStyle(ButtonStyle.Secondary),
      );
    }
  }

  return {
    embeds: [embed],
    components: row.components.length > 0 ? [row] : [],
  };
}

export function buildTvDetailsEmbed(
  tv: OverseerrTv,
  can4k: boolean,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
} {
  const status = tv.mediaInfo?.status ?? MediaStatus.UNKNOWN;
  const alreadyAvailable = status === MediaStatus.AVAILABLE;

  const embed = new EmbedBuilder()
    .setColor(alreadyAvailable ? EmbedColor.AVAILABLE : EmbedColor.INFO)
    .setTitle(tv.name)
    .setURL(`https://www.themoviedb.org/tv/${tv.id}`)
    .setDescription(truncate(tv.overview, 1024));

  if (tv.posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${tv.posterPath}`);
  }
  if (tv.backdropPath) {
    embed.setImage(`${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZE}${tv.backdropPath}`);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (tv.firstAirDate) {
    fields.push({
      name: "First Aired",
      value: new Date(tv.firstAirDate).toLocaleDateString(),
      inline: true,
    });
  }
  fields.push({
    name: "Seasons",
    value: `${tv.numberOfSeasons}`,
    inline: true,
  });
  fields.push({
    name: "Episodes",
    value: `${tv.numberOfEpisodes}`,
    inline: true,
  });
  if (tv.voteAverage) {
    fields.push({
      name: "Rating",
      value: `${tv.voteAverage.toFixed(1)}/10`,
      inline: true,
    });
  }
  if (tv.genres?.length) {
    fields.push({
      name: "Genres",
      value: tv.genres.map((g) => g.name).join(", "),
      inline: false,
    });
  }
  if (alreadyAvailable) {
    fields.push({ name: "Status", value: "Available", inline: true });
  }

  embed.addFields(fields);

  if (alreadyAvailable) {
    return { embeds: [embed], components: [] };
  }

  const availableSeasons = tv.seasons.filter((s) => s.seasonNumber > 0);

  if (availableSeasons.length === 0) {
    return { embeds: [embed], components: [] };
  }

  const is4kSuffix = can4k ? ":4k" : "";
  const seasonOptions = availableSeasons.map((s) => ({
    label: s.name || `Season ${s.seasonNumber}`,
    value: `${s.seasonNumber}`,
    description: `${s.episodeCount} episodes`,
  }));

  seasonOptions.unshift({
    label: "All Seasons",
    value: "all",
    description: `Request all ${availableSeasons.length} seasons`,
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CustomId.SEASON_SELECT}:${tv.id}${is4kSuffix}`)
    .setPlaceholder("Select seasons to request...")
    .setMinValues(1)
    .setMaxValues(seasonOptions.length)
    .addOptions(seasonOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embeds: [embed], components: [row] };
}
