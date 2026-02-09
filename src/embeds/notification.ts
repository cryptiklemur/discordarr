import { EmbedBuilder } from "discord.js";
import { EmbedColor, TMDB_IMAGE_BASE, TMDB_POSTER_SIZE } from "../utils/constants.js";

export function buildApprovedDmEmbed(
  title: string,
  posterPath?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColor.SUCCESS)
    .setTitle("Request Approved!")
    .setDescription(`Your request for **${title}** has been approved! It will be downloaded shortly.`);

  if (posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${posterPath}`);
  }

  return embed;
}

export function buildDeniedDmEmbed(
  title: string,
  posterPath?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColor.DENIED)
    .setTitle("Request Denied")
    .setDescription(`Your request for **${title}** has been denied.`);

  if (posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${posterPath}`);
  }

  return embed;
}

export function buildAvailableDmEmbed(
  title: string,
  posterPath?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColor.AVAILABLE)
    .setTitle("Now Available!")
    .setDescription(`**${title}** is now available to watch!`);

  if (posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${posterPath}`);
  }

  return embed;
}

export function buildSubmittedDmEmbed(
  title: string,
  posterPath?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColor.PENDING)
    .setTitle("Request Submitted")
    .setDescription(`Your request for **${title}** has been submitted and is awaiting approval.`);

  if (posterPath) {
    embed.setThumbnail(`${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${posterPath}`);
  }

  return embed;
}
