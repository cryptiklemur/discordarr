import { EmbedBuilder } from "discord.js";
import { EmbedColor } from "../utils/constants.js";

export function buildIndexerSearchEmbed(title: string, service: "sonarr" | "radarr"): EmbedBuilder {
  const serviceName = service === "sonarr" ? "Sonarr" : "Radarr";

  return new EmbedBuilder()
    .setTitle("Search Triggered")
    .setDescription(`Search triggered for **${title}**. Check \`/${service} queue\` for results.`)
    .setColor(EmbedColor.INFO)
    .setTimestamp()
    .setFooter({ text: `${serviceName} Indexer Search` });
}
