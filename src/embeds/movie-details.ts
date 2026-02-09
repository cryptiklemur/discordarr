import { EmbedBuilder } from "discord.js";
import type { RadarrMovie } from "../services/radarr.js";
import { EmbedColor } from "../utils/constants.js";
import { formatFileSize, truncate } from "../utils/format.js";

export function buildMovieDetailsEmbed(movie: RadarrMovie): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${movie.title} (${movie.year})`)
    .setColor(EmbedColor.INFO)
    .setTimestamp();

  if (movie.overview) {
    embed.setDescription(truncate(movie.overview, 400));
  }

  const infoLines: string[] = [];

  if (movie.genres && movie.genres.length > 0) {
    infoLines.push(`**Genres:** ${movie.genres.join(", ")}`);
  }

  if (movie.certification) {
    infoLines.push(`**Certification:** ${movie.certification}`);
  }

  if (movie.studio) {
    infoLines.push(`**Studio:** ${movie.studio}`);
  }

  if (movie.runtime) {
    const hours = Math.floor(movie.runtime / 60);
    const minutes = movie.runtime % 60;
    const runtime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    infoLines.push(`**Runtime:** ${runtime}`);
  }

  infoLines.push(`**Status:** ${movie.status}`);

  if (movie.ratings?.imdb?.value) {
    infoLines.push(`**IMDB Rating:** ${movie.ratings.imdb.value.toFixed(1)}/10`);
  }

  if (infoLines.length > 0) {
    embed.addFields({ name: "Information", value: infoLines.join("\n"), inline: false });
  }

  if (movie.hasFile && movie.movieFile) {
    const fileLines: string[] = [];
    const file = movie.movieFile;

    fileLines.push(`**Quality:** ${file.quality.quality.name}`);
    fileLines.push(`**Size:** ${formatFileSize(file.size)}`);

    if (file.mediaInfo) {
      if (file.mediaInfo.videoCodec) {
        fileLines.push(`**Video Codec:** ${file.mediaInfo.videoCodec}`);
      }
      if (file.mediaInfo.audioCodec) {
        fileLines.push(`**Audio Codec:** ${file.mediaInfo.audioCodec}`);
      }
      if (file.mediaInfo.resolution) {
        fileLines.push(`**Resolution:** ${file.mediaInfo.resolution}`);
      }
    }

    if (file.relativePath) {
      fileLines.push(`**Path:** ${truncate(file.relativePath, 100)}`);
    } else if (movie.path) {
      fileLines.push(`**Path:** ${truncate(movie.path, 100)}`);
    }

    embed.addFields({ name: "File Information", value: fileLines.join("\n"), inline: false });
  } else {
    embed.addFields({
      name: "File Information",
      value: "No file available",
      inline: false,
    });
  }

  if (movie.images && movie.images.length > 0) {
    const fanart = movie.images.find((img) => img.coverType === "fanart");
    const poster = movie.images.find((img) => img.coverType === "poster");
    const image = fanart || poster;

    if (image) {
      const imageUrl = image.remoteUrl || image.url;
      if (imageUrl) {
        embed.setImage(imageUrl);
      }
    }
  }

  return embed;
}
