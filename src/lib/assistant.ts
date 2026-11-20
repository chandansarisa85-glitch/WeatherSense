import { describeWeather } from "@/lib/weather-codes";
import {
  currentHour,
  findDay,
  formatClock,
  formatMonthDay,
  formatNumber,
  formatTemp,
  formatWeekday,
  shiftDate,
  todayKey,
  uvLabel,
} from "@/lib/format";
import type { DailyPoint, WeatherSnapshot } from "@/lib/types";

export const SUGGESTED_QUESTIONS = [
  "Will it rain today?",
  "Is tomorrow suitable for outdoor activities?",
  "Compare today's weather with yesterday.",
  "Explain the current UV index.",
  "Should I carry an umbrella?",
] as const;

function dayLine(day: DailyPoint | null, fallback: string) {
  if (!day) return fallback;
  const described = describeWeather(day.weatherCode);
  return `${formatWeekday(day.date, "long")} ${formatMonthDay(day.date)} is forecast as ${described.label.toLowerCase()}, ${formatTemp(day.tempMin)} to ${formatTemp(day.tempMax)}, with ${formatNumber(day.precipitationProbability)}% precipitation probability, ${formatNumber(day.precipitationSum, 1)} mm of precipitation, and wind up to ${formatNumber(day.windSpeedMax)} km/h.`;
}

function remainingRain(snapshot: WeatherSnapshot) {
  const start = snapshot.current.time.slice(0, 13);
  const date = todayKey(snapshot);
  const hours = snapshot.hourly.filter(
    (hour) => hour.time.slice(0, 10) === date && hour.time.slice(0, 13) >= start,
  );
  const probabilities = hours
    .map((hour) => hour.precipitationProbability)
    .filter((value): value is number => value != null);
  const max = probabilities.length ? Math.max(...probabilities) : null;
  const wet = hours
    .filter((hour) => (hour.precipitationProbability ?? 0) >= 40)
    .map((hour) => formatClock(hour.time));
  return { max, wet: wet.slice(0, 6), hours: hours.length };
}

function outdoorVerdict(day: DailyPoint) {
  const kind = describeWeather(day.weatherCode).kind;
  const reasons: string[] = [];
  if (kind === "stormy") reasons.push("thunderstorms are in the daily code");
  if ((day.precipitationProbability ?? 0) >= 40) reasons.push("precipitation probability is 40% or higher");
  if ((day.windSpeedMax ?? 0) >= 40) reasons.push("wind reaches 40 km/h or more");
  if (day.tempMax != null && day.tempMax > 32) reasons.push("the high is above 32°C");
  if (day.tempMin != null && day.tempMin < 8) reasons.push("the low is below 8°C");
  return reasons;
}

export function answerQuestion(question: string, snapshot: WeatherSnapshot) {
  const text = question.toLowerCase();
  const place = snapshot.place.name;
  const today = findDay(snapshot, 0);
  const tomorrow = findDay(snapshot, 1);
  const yesterday = findDay(snapshot, -1);
  const hour = currentHour(snapshot);
  const described = describeWeather(snapshot.current.weatherCode);

  if (text.includes("umbrella")) {
    const rain = remainingRain(snapshot);
    const wetNow = described.kind === "rainy" || described.kind === "stormy" || described.kind === "snowy";
    const likely = wetNow || (rain.max ?? 0) >= 40 || (today?.precipitationProbability ?? 0) >= 40;
    return likely
      ? `Yes. In ${place}, conditions are currently ${described.label.toLowerCase()}. ${rain.max == null ? "The remaining hourly precipitation probabilities were not included." : `The highest remaining precipitation probability today is ${Math.round(rain.max)}%.`} ${dayLine(today, "Today's daily summary is unavailable.")}`
      : `An umbrella is optional from this forecast. ${place} is currently ${described.label.toLowerCase()}, and ${rain.max == null ? "remaining rain probabilities were not included." : `the highest remaining precipitation probability today is ${Math.round(rain.max)}%.`}`;
  }

  if (text.includes("uv")) {
    const currentUv = hour?.uvIndex ?? null;
    const max = today?.uvIndexMax ?? null;
    if (currentUv == null && max == null) {
      return `OpenWeather's standard five-day forecast does not include UV data for ${place}, so I can't give a verified UV index from the loaded response.`;
    }
    return `The UV index loaded for ${place} is ${formatNumber(currentUv, 1)} at ${hour ? formatClock(hour.time) : "the current hour"}, which is ${uvLabel(currentUv).toLowerCase()} on the standard 0–11 scale. ${max == null ? "A daily maximum was not included." : `Today's maximum in the daily forecast is ${formatNumber(max, 1)} (${uvLabel(max).toLowerCase()}).`} Low is under 3, moderate is 3–5, high is 6–7, very high is 8–10, and extreme is 11 or more.`;
  }

  if (text.includes("yesterday") || text.includes("compare")) {
    if (!today || !yesterday) {
      return `I can't compare yesterday with today because the loaded OpenWeather forecast does not include historical weather.`;
    }
    const highDelta =
      today.tempMax != null && yesterday.tempMax != null ? Math.round(today.tempMax - yesterday.tempMax) : null;
    return `${dayLine(yesterday, "")} ${dayLine(today, "")} ${highDelta == null ? "A high-temperature difference is unavailable because one of the values is missing." : `Today's high is ${highDelta === 0 ? "the same as" : highDelta > 0 ? `${highDelta}°C warmer than` : `${Math.abs(highDelta)}°C cooler than`} yesterday's high.`}`;
  }

  if (text.includes("tomorrow") || text.includes("outdoor")) {
    if (!tomorrow) return `Tomorrow is outside the daily forecast loaded for ${place}.`;
    const reasons = outdoorVerdict(tomorrow);
    const verdict = reasons.length
      ? `It looks less suitable for a long time outdoors because ${reasons.join(", ")}.`
      : "It looks suitable for outdoor plans on a simple comfort check: precipitation probability under 40%, wind under 40 km/h, no thunderstorm code, and temperatures between 8°C and 32°C.";
    return `${dayLine(tomorrow, "")} ${verdict}`;
  }

  if (text.includes("rain") || text.includes("precip") || text.includes("shower")) {
    const rain = remainingRain(snapshot);
    return `${place} is currently ${described.label.toLowerCase()}. ${dayLine(today, "Today's daily precipitation summary is unavailable.")} The daily summary covers the full local day; the remaining hourly outlook starts at the current local time. ${rain.max == null ? "Remaining hourly probabilities were not included." : `From ${formatClock(snapshot.current.time)} onward, the highest precipitation probability is ${Math.round(rain.max)}%.`} ${rain.wet.length ? `Hours at 40% or more: ${rain.wet.join(", ")}.` : "No remaining hour today is at 40% or more."}`;
  }

  if (text.includes("wind")) {
    return `Wind in ${place} is ${formatNumber(snapshot.current.windSpeed)} km/h from ${formatNumber(snapshot.current.windDirection)}°. ${today?.windSpeedMax == null ? "Today's maximum wind was not included." : `Today's forecast maximum is ${formatNumber(today.windSpeedMax)} km/h.`}`;
  }

  if (text.includes("humid")) {
    return `Relative humidity in ${place} is ${formatNumber(snapshot.current.humidity)}%. ${hour?.humidity == null ? "" : `The matching hourly value is ${formatNumber(hour.humidity)}%.`}`;
  }

  if (text.includes("temperature") || text.includes("hot") || text.includes("cold") || text.includes("warm")) {
    return `${place} is ${formatTemp(snapshot.current.temperature, true)} and feels like ${formatTemp(snapshot.current.apparentTemperature, true)}. ${dayLine(today, "Today's high and low were not included.")}`;
  }

  if (text.includes("snow")) {
    const snowDays = snapshot.daily.filter((day) => describeWeather(day.weatherCode).kind === "snowy");
    if (!snowDays.length && described.kind !== "snowy") {
      return `No snow is in the current conditions or the loaded daily forecast for ${place}. Current conditions are ${described.label.toLowerCase()}.`;
    }
    const names = snowDays.map((day) => formatWeekday(day.date)).join(", ");
    return `${described.kind === "snowy" ? `Snow is in the current conditions for ${place}. ` : ""}Snow appears on ${names || "the current observation"}.`;
  }

  if (text.includes("weekend")) {
    const saturday = snapshot.daily.find((day) => new Date(`${day.date}T12:00:00Z`).getUTCDay() === 6);
    const sunday = saturday ? snapshot.daily.find((day) => day.date === shiftDate(saturday.date, 1)) : null;
    if (!saturday) return `The loaded forecast for ${place} does not include Saturday.`;
    return `${dayLine(saturday, "")} ${sunday ? dayLine(sunday, "") : "Sunday is not in the loaded forecast."}`;
  }

  return `I can only answer from the OpenWeather forecast loaded for ${place}. Ask about rain, an umbrella, tomorrow's outdoor conditions, yesterday's comparison, UV, wind, humidity, or temperature.`;
}
