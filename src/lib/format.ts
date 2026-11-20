import type { WeatherSnapshot } from "@/lib/types";

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function formatClock(iso: string) {
  const hour = Number(iso.slice(11, 13));
  const minute = iso.slice(14, 16);
  if (!Number.isFinite(hour)) return "—";
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return minute && minute !== "00" ? `${hour12}:${minute} ${suffix}` : `${hour12} ${suffix}`;
}

export function formatWeekday(date: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat(undefined, { weekday: style, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function formatMonthDay(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatFullDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatUpdated(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatTemp(value: number | null | undefined, withUnit = false) {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  return withUnit ? `${rounded}°C` : `${rounded}°`;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function compass(degrees: number | null) {
  if (degrees == null || Number.isNaN(degrees)) return "—";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

export function uvLabel(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  if (value < 3) return "Low";
  if (value < 6) return "Moderate";
  if (value < 8) return "High";
  if (value < 11) return "Very high";
  return "Extreme";
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function todayKey(snapshot: WeatherSnapshot) {
  return snapshot.current.time.slice(0, 10);
}

export function findDay(snapshot: WeatherSnapshot, offset = 0) {
  const date = shiftDate(todayKey(snapshot), offset);
  return snapshot.daily.find((day) => day.date === date) ?? null;
}

export function currentHour(snapshot: WeatherSnapshot) {
  const key = snapshot.current.time.slice(0, 13);
  return (
    snapshot.hourly.find((hour) => hour.time.slice(0, 13) === key) ??
    [...snapshot.hourly].reverse().find((hour) => hour.time <= snapshot.current.time) ??
    null
  );
}

export function upcomingHours(snapshot: WeatherSnapshot, count: number) {
  const start = snapshot.current.time.slice(0, 13);
  const future = snapshot.hourly.filter((hour) => hour.time.slice(0, 13) >= start);
  return future.slice(0, Math.ceil(count / Math.max(1, snapshot.hourlyIntervalHours)));
}
