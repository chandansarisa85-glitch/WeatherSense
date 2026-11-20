import { describeWeather } from "@/lib/weather-codes";
import { findDay, formatNumber } from "@/lib/format";
import type { WeatherAlert, WeatherSnapshot } from "@/lib/types";

/** Configured WeatherSense thresholds. These are not official weather warnings. */
export const THRESHOLDS = {
  rainModerateMm: 10,
  rainHighMm: 25,
  rainSevereMm: 50,
  rainChance: 70,
  windModerate: 40,
  windHigh: 60,
  windSevere: 80,
  hotModerate: 32,
  hotHigh: 36,
  hotSevere: 40,
  coldModerate: 0,
  coldHigh: -8,
  coldSevere: -15,
  uvModerate: 6,
  uvHigh: 8,
  uvSevere: 11,
} as const;

const rank = { info: 0, moderate: 1, high: 2, severe: 3 } as const;

function rainSeverity(amount: number): WeatherAlert["severity"] | null {
  if (amount >= THRESHOLDS.rainSevereMm) return "severe";
  if (amount >= THRESHOLDS.rainHighMm) return "high";
  if (amount >= THRESHOLDS.rainModerateMm) return "moderate";
  return null;
}

function windSeverity(speed: number): WeatherAlert["severity"] | null {
  if (speed >= THRESHOLDS.windSevere) return "severe";
  if (speed >= THRESHOLDS.windHigh) return "high";
  if (speed >= THRESHOLDS.windModerate) return "moderate";
  return null;
}

function heatSeverity(temp: number): WeatherAlert["severity"] | null {
  if (temp >= THRESHOLDS.hotSevere) return "severe";
  if (temp >= THRESHOLDS.hotHigh) return "high";
  if (temp >= THRESHOLDS.hotModerate) return "moderate";
  return null;
}

function coldSeverity(temp: number): WeatherAlert["severity"] | null {
  if (temp <= THRESHOLDS.coldSevere) return "severe";
  if (temp <= THRESHOLDS.coldHigh) return "high";
  if (temp <= THRESHOLDS.coldModerate) return "moderate";
  return null;
}

function uvSeverity(uv: number): WeatherAlert["severity"] | null {
  if (uv >= THRESHOLDS.uvSevere) return "severe";
  if (uv >= THRESHOLDS.uvHigh) return "high";
  if (uv >= THRESHOLDS.uvModerate) return "moderate";
  return null;
}

export function buildAlerts(snapshot: WeatherSnapshot): WeatherAlert[] {
  const today = findDay(snapshot, 0);
  const alerts: WeatherAlert[] = [];
  const currentKind = describeWeather(snapshot.current.weatherCode).kind;
  const todayKind = describeWeather(today?.weatherCode ?? null).kind;

  if (currentKind === "stormy" || todayKind === "stormy") {
    alerts.push({
      id: "thunderstorm",
      title: "Thunderstorm conditions",
      detail:
        currentKind === "stormy"
          ? `The current OpenWeather condition code is ${snapshot.current.weatherCode}, which indicates a thunderstorm.`
          : `Today's OpenWeather forecast condition code is ${today?.weatherCode}, which indicates thunderstorm conditions.`,
      severity: currentKind === "stormy" ? "high" : "moderate",
      source: "weathersense-threshold",
    });
  }

  if (today?.precipitationSum != null) {
    const severity = rainSeverity(today.precipitationSum);
    if (severity) {
      alerts.push({
        id: "rainfall",
        title: "Heavy rainfall",
        detail: `The available OpenWeather forecast intervals for today total ${formatNumber(today.precipitationSum, 1)} mm. WeatherSense flags totals from ${THRESHOLDS.rainModerateMm} mm upward.`,
        severity,
        source: "weathersense-threshold",
      });
    }
  }

  if (
    today?.precipitationProbability != null &&
    today.precipitationProbability >= THRESHOLDS.rainChance &&
    !alerts.some((alert) => alert.id === "rainfall")
  ) {
    alerts.push({
      id: "rain-chance",
      title: "High chance of precipitation",
      detail: `Today's maximum precipitation probability is ${Math.round(today.precipitationProbability)}%, at or above the ${THRESHOLDS.rainChance}% notice threshold.`,
      severity: "moderate",
      source: "weathersense-threshold",
    });
  }

  const wind = Math.max(snapshot.current.windSpeed ?? 0, today?.windSpeedMax ?? 0);
  const windLevel = windSeverity(wind);
  if (windLevel && (snapshot.current.windSpeed != null || today?.windSpeedMax != null)) {
    alerts.push({
      id: "wind",
      title: "Strong winds",
      detail: `Current wind is ${formatNumber(snapshot.current.windSpeed)} km/h and today's maximum is ${formatNumber(today?.windSpeedMax)} km/h. Notices begin at ${THRESHOLDS.windModerate} km/h.`,
      severity: windLevel,
      source: "weathersense-threshold",
    });
  }

  if (today?.tempMax != null) {
    const severity = heatSeverity(today.tempMax);
    if (severity) {
      alerts.push({
        id: "heat",
        title: "Extreme heat",
        detail: `Today's forecast high is ${Math.round(today.tempMax)}°C. Heat notices begin at ${THRESHOLDS.hotModerate}°C.`,
        severity,
        source: "weathersense-threshold",
      });
    }
  }

  if (today?.tempMin != null) {
    const severity = coldSeverity(today.tempMin);
    if (severity) {
      alerts.push({
        id: "cold",
        title: "Extreme cold",
        detail: `Today's forecast low is ${Math.round(today.tempMin)}°C. Cold notices begin at ${THRESHOLDS.coldModerate}°C.`,
        severity,
        source: "weathersense-threshold",
      });
    }
  }

  if (today?.uvIndexMax != null) {
    const severity = uvSeverity(today.uvIndexMax);
    if (severity) {
      alerts.push({
        id: "uv",
        title: "High UV conditions",
        detail: `Today's maximum UV index is ${formatNumber(today.uvIndexMax, 1)}. Notices begin at index ${THRESHOLDS.uvModerate}.`,
        severity,
        source: "weathersense-threshold",
      });
    }
  }

  return alerts.sort((a, b) => rank[b.severity] - rank[a.severity]);
}
