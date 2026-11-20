import type { WeatherKind } from "@/lib/types";

export function describeWeather(code: number | null): { label: string; kind: WeatherKind } {
  if (code == null) return { label: "Conditions unavailable", kind: "cloudy" };
  if (code === 0) return { label: "Clear sky", kind: "sunny" };
  if (code === 1) return { label: "Mainly clear", kind: "sunny" };
  if (code === 2) return { label: "Partly cloudy", kind: "cloudy" };
  if (code === 3) return { label: "Overcast", kind: "cloudy" };
  if (code === 45 || code === 48) return { label: "Fog", kind: "cloudy" };
  if (code >= 51 && code <= 55) return { label: "Drizzle", kind: "rainy" };
  if (code === 56 || code === 57) return { label: "Freezing drizzle", kind: "rainy" };
  if (code >= 61 && code <= 65) return { label: "Rain", kind: "rainy" };
  if (code === 66 || code === 67) return { label: "Freezing rain", kind: "rainy" };
  if (code >= 71 && code <= 77) return { label: "Snow", kind: "snowy" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", kind: "rainy" };
  if (code === 85 || code === 86) return { label: "Snow showers", kind: "snowy" };
  if (code >= 95) return { label: "Thunderstorm", kind: "stormy" };
  return { label: "Conditions unavailable", kind: "cloudy" };
}
