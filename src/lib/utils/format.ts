import {
  format,
  formatDistance,
  formatRelative,
  isValid,
  parseISO,
} from "date-fns";

// Date formatting utilities
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = "PPP"
): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return format(d, formatStr);
}

export function formatDateTime(
  date: Date | string | null | undefined
): string {
  return formatDate(date, "PPP p");
}

export function formatDateShort(
  date: Date | string | null | undefined
): string {
  return formatDate(date, "MMM d, yyyy");
}

export function formatTime(date: Date | string | null | undefined): string {
  return formatDate(date, "p");
}

export function formatRelativeTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return formatDistance(d, new Date(), { addSuffix: true });
}

export function formatRelativeDate(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  return formatRelative(d, new Date());
}

// Number formatting utilities
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return new Intl.NumberFormat().format(num);
}

export function formatCompactNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(num);
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "USD"
): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value == null) return "0%";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = sizes[i];

  if (!size) return `${bytes} Bytes`;

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${size}`;
}

// String utilities
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function generateInitials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() ?? "??";
  }
  return (
    (parts[0]?.[0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.[0]?.toUpperCase() ?? "")
  );
}
