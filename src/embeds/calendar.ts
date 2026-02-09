import { EmbedBuilder } from "discord.js";
import type { SonarrCalendarEntry } from "../services/sonarr.js";
import type { RadarrMovie } from "../services/radarr.js";
import { EmbedColor } from "../utils/constants.js";
import { formatDate, formatSeasonEpisode, truncate } from "../utils/format.js";

export function buildSonarrCalendarEmbed(episodes: SonarrCalendarEntry[], days: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Sonarr Calendar - Next ${days} Days`)
    .setColor(EmbedColor.INFO)
    .setTimestamp();

  if (episodes.length === 0) {
    embed.setDescription("No upcoming episodes");
    return embed;
  }

  const episodesByDate = new Map<string, SonarrCalendarEntry[]>();

  for (const episode of episodes) {
    if (!episode.airDateUtc) continue;

    const date = formatDate(episode.airDateUtc);
    if (!episodesByDate.has(date)) {
      episodesByDate.set(date, []);
    }
    episodesByDate.get(date)!.push(episode);
  }

  const sortedDates = Array.from(episodesByDate.keys()).sort((a, b) => {
    const dateA = new Date(episodesByDate.get(a)![0].airDateUtc!);
    const dateB = new Date(episodesByDate.get(b)![0].airDateUtc!);
    return dateA.getTime() - dateB.getTime();
  });

  for (const date of sortedDates) {
    const dateEpisodes = episodesByDate.get(date)!;
    const episodeLines = dateEpisodes.map((ep) => {
      const seriesTitle = truncate(ep.series.title, 30);
      const epCode = formatSeasonEpisode(ep.seasonNumber, ep.episodeNumber);
      const epTitle = truncate(ep.title, 40);
      return `${seriesTitle} - ${epCode} - ${epTitle}`;
    });

    const value = episodeLines.join("\n");
    embed.addFields({ name: date, value: value || "No episodes", inline: false });
  }

  embed.setFooter({ text: `${episodes.length} episode${episodes.length === 1 ? "" : "s"}` });

  return embed;
}

export function buildRadarrCalendarEmbed(movies: RadarrMovie[], days: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Radarr Calendar - Next ${days} Days`)
    .setColor(EmbedColor.INFO)
    .setTimestamp();

  if (movies.length === 0) {
    embed.setDescription("No upcoming releases");
    return embed;
  }

  const moviesByDate = new Map<string, { movie: RadarrMovie; releaseType: string }[]>();

  for (const movie of movies) {
    let releaseDate: string | undefined;
    let releaseType: string;

    if (movie.physicalRelease) {
      releaseDate = movie.physicalRelease;
      releaseType = "Physical";
    } else if (movie.digitalRelease) {
      releaseDate = movie.digitalRelease;
      releaseType = "Digital";
    } else if (movie.inCinemas) {
      releaseDate = movie.inCinemas;
      releaseType = "Theatrical";
    } else {
      continue;
    }

    const date = formatDate(releaseDate);
    if (!moviesByDate.has(date)) {
      moviesByDate.set(date, []);
    }
    moviesByDate.get(date)!.push({ movie, releaseType });
  }

  const sortedDates = Array.from(moviesByDate.keys()).sort((a, b) => {
    const moviesA = moviesByDate.get(a)![0];
    const moviesB = moviesByDate.get(b)![0];
    const dateA = new Date(
      moviesA.movie.physicalRelease || moviesA.movie.digitalRelease || moviesA.movie.inCinemas!
    );
    const dateB = new Date(
      moviesB.movie.physicalRelease || moviesB.movie.digitalRelease || moviesB.movie.inCinemas!
    );
    return dateA.getTime() - dateB.getTime();
  });

  for (const date of sortedDates) {
    const dateMovies = moviesByDate.get(date)!;
    const movieLines = dateMovies.map(({ movie, releaseType }) => {
      const title = truncate(movie.title, 50);
      return `${title} (${movie.year}) - ${releaseType}`;
    });

    const value = movieLines.join("\n");
    embed.addFields({ name: date, value: value || "No releases", inline: false });
  }

  embed.setFooter({ text: `${movies.length} movie${movies.length === 1 ? "" : "s"}` });

  return embed;
}
