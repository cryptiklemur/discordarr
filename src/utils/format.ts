export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatEta(timeleft: string): string {
  const match = timeleft.match(/^(\d+):(\d+):(\d+)$/);
  if (!match) return timeleft;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const secs = parseInt(match[3], 10);
  return formatDuration(hours * 3600 + mins * 60 + secs);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function formatYear(date: string | undefined): string {
  if (!date) return "N/A";
  return new Date(date).getFullYear().toString();
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatSeasonEpisode(season: number, episode: number): string {
  return `S${season.toString().padStart(2, "0")}E${episode.toString().padStart(2, "0")}`;
}
