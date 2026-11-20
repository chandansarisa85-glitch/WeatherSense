import type { CurrentWeather, DailyPoint, HourlyPoint, Place, WeatherSnapshot } from "@/lib/types";

const API_ROOT = "https://api.openweathermap.org";

export class OpenWeatherError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "OpenWeatherError";
  }
}

function apiKey() {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new OpenWeatherError("OpenWeather is not configured. Add OPENWEATHER_API_KEY to the server environment.", 503);
  return key;
}

async function getJson<T>(path: string, params: Record<string, string>) {
  const url = new URL(path, API_ROOT);
  for (const [key, value] of Object.entries({ ...params, appid: apiKey() })) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000), next: { revalidate: 300 } });
  } catch {
    throw new OpenWeatherError("OpenWeather could not be reached. Check your connection and try again.", 502);
  }
  if (!response.ok) {
    if (response.status === 401) throw new OpenWeatherError("OpenWeather rejected the API key. Check that it is active and enabled for these endpoints.", 401);
    if (response.status === 429) throw new OpenWeatherError("OpenWeather request limit reached. Try again later.", 429);
    throw new OpenWeatherError(`OpenWeather request failed (${response.status}).`, response.status);
  }
  return (await response.json()) as T;
}

type GeoItem = { name: string; country?: string; state?: string; lat: number; lon: number; local_names?: Record<string, string> };
type WeatherItem = { id: number; main?: string; description?: string; icon?: string };
type CurrentPayload = {
  coord: { lat: number; lon: number };
  weather: WeatherItem[];
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; pressure: number; humidity: number };
  visibility?: number;
  wind?: { speed?: number; deg?: number };
  clouds?: { all?: number };
  rain?: { "1h"?: number; "3h"?: number };
  snow?: { "1h"?: number; "3h"?: number };
  dt: number;
  sys: { country?: string; sunrise: number; sunset: number };
  timezone: number;
  name: string;
};
type ForecastEntry = {
  dt: number;
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; pressure: number; humidity: number };
  weather: WeatherItem[];
  clouds?: { all?: number };
  wind?: { speed?: number; deg?: number };
  visibility?: number;
  pop?: number;
  rain?: { "3h"?: number };
  snow?: { "3h"?: number };
};
type ForecastPayload = { list: ForecastEntry[]; city: { timezone: number } };

function toPlace(item: GeoItem): Place {
  const countryName = item.country ? new Intl.DisplayNames(["en"], { type: "region" }).of(item.country) : undefined;
  return {
    id: Math.round(item.lat * 1000 + item.lon),
    name: item.name,
    country: countryName || item.country || "",
    admin1: item.state,
    latitude: item.lat,
    longitude: item.lon,
  };
}

export async function searchOpenWeatherPlaces(query: string) {
  const rows = await getJson<GeoItem[]>("/geo/1.0/direct", { q: query, limit: "6" });
  return rows.map(toPlace);
}

export async function reverseOpenWeatherPlace(latitude: number, longitude: number) {
  const rows = await getJson<GeoItem[]>("/geo/1.0/reverse", { lat: String(latitude), lon: String(longitude), limit: "1" });
  return rows[0] ? toPlace(rows[0]) : { id: -1, name: "Current location", country: "", latitude, longitude };
}

function localDateTime(timestamp: number, timezoneOffset: number) {
  return new Date((timestamp + timezoneOffset) * 1000).toISOString().slice(0, 16);
}

function toWeatherCode(id: number): number {
  if (id >= 200 && id < 300) return 95;
  if (id >= 300 && id < 400) return 51;
  if (id === 511 || (id >= 611 && id <= 616)) return 66;
  if (id >= 600 && id <= 602) return id === 600 ? 71 : id === 601 ? 73 : 75;
  if (id >= 620 && id <= 622) return id === 620 ? 85 : 86;
  if (id >= 500 && id < 600) return id >= 502 ? 65 : id === 501 ? 63 : id >= 520 ? 80 : 61;
  if (id === 781 || id === 771) return 95;
  if (id >= 700 && id < 800) return 45;
  if (id === 800) return 0;
  if (id === 801) return 2;
  if (id === 802) return 2;
  if (id >= 803 && id < 900) return 3;
  return 3;
}

function amount(entry: ForecastEntry) {
  return (entry.rain?.["3h"] ?? 0) + (entry.snow?.["3h"] ?? 0);
}

function toCurrent(payload: CurrentPayload): CurrentWeather {
  const weather = payload.weather[0];
  const localTime = localDateTime(payload.dt, payload.timezone);
  const sunrise = localDateTime(payload.sys.sunrise, payload.timezone);
  const sunset = localDateTime(payload.sys.sunset, payload.timezone);
  return {
    time: localTime,
    temperature: payload.main.temp,
    apparentTemperature: payload.main.feels_like,
    humidity: payload.main.humidity,
    windSpeed: payload.wind?.speed == null ? null : payload.wind.speed * 3.6,
    windDirection: payload.wind?.deg ?? null,
    pressure: payload.main.pressure,
    visibility: payload.visibility ?? null,
    precipitation: (payload.rain?.["1h"] ?? payload.rain?.["3h"] ?? 0) + (payload.snow?.["1h"] ?? payload.snow?.["3h"] ?? 0),
    cloudCover: payload.clouds?.all ?? null,
    weatherCode: toWeatherCode(weather?.id ?? 804),
    isDay: localTime >= sunrise && localTime < sunset,
  };
}

function toHourly(entry: ForecastEntry, timezoneOffset: number): HourlyPoint {
  return {
    time: localDateTime(entry.dt, timezoneOffset),
    temperature: entry.main.temp,
    precipitationProbability: entry.pop == null ? null : Math.round(entry.pop * 100),
    weatherCode: toWeatherCode(entry.weather[0]?.id ?? 804),
    windSpeed: entry.wind?.speed == null ? null : entry.wind.speed * 3.6,
    humidity: entry.main.humidity,
    uvIndex: null,
    precipitation: amount(entry),
  };
}

function toDaily(entries: ForecastEntry[], date: string, timezoneOffset: number, today: CurrentPayload): DailyPoint {
  const codes = new Map<number, number>();
  for (const entry of entries) {
    const code = toWeatherCode(entry.weather[0]?.id ?? 804);
    codes.set(code, (codes.get(code) ?? 0) + 1);
  }
  const weatherCode = [...codes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lows = entries.map((entry) => entry.main.temp_min).filter(Number.isFinite);
  const highs = entries.map((entry) => entry.main.temp_max).filter(Number.isFinite);
  const humidities = entries.map((entry) => entry.main.humidity).filter(Number.isFinite);
  const probabilities = entries.map((entry) => entry.pop).filter((value): value is number => value != null);
  const localToday = localDateTime(today.dt, timezoneOffset).slice(0, 10) === date;
  return {
    date,
    weatherCode,
    tempMax: highs.length ? Math.max(...highs) : null,
    tempMin: lows.length ? Math.min(...lows) : null,
    sunrise: localToday ? localDateTime(today.sys.sunrise, timezoneOffset) : null,
    sunset: localToday ? localDateTime(today.sys.sunset, timezoneOffset) : null,
    precipitationProbability: probabilities.length ? Math.round(Math.max(...probabilities) * 100) : null,
    uvIndexMax: null,
    humidity: humidities.length ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length : null,
    precipitationSum: entries.length ? entries.reduce((sum, entry) => sum + amount(entry), 0) : null,
    windSpeedMax: entries.length ? Math.max(...entries.map((entry) => (entry.wind?.speed ?? 0) * 3.6)) : null,
  };
}

export async function fetchOpenWeatherSnapshot(place: Place): Promise<WeatherSnapshot> {
  const params = { lat: String(place.latitude), lon: String(place.longitude), units: "metric" };
  const [currentPayload, forecastPayload] = await Promise.all([
    getJson<CurrentPayload>("/data/2.5/weather", params),
    getJson<ForecastPayload>("/data/2.5/forecast", params),
  ]);
  if (!currentPayload.main || !currentPayload.weather?.length || !forecastPayload.list?.length) {
    throw new OpenWeatherError("OpenWeather returned an incomplete forecast.", 502);
  }
  const offset = currentPayload.timezone ?? forecastPayload.city.timezone ?? 0;
  const hourly = forecastPayload.list.map((entry) => toHourly(entry, offset));
  const grouped = new Map<string, ForecastEntry[]>();
  for (const entry of forecastPayload.list) {
    const date = localDateTime(entry.dt, offset).slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), entry]);
  }
  const today = localDateTime(currentPayload.dt, offset).slice(0, 10);
  const dates = [...grouped.keys()].sort();
  if (!dates.includes(today)) dates.unshift(today);
  const daily = dates.map((date) => toDaily(grouped.get(date) ?? [], date, offset, currentPayload)).slice(0, 5);
  const timezoneHours = offset / 3600;
  const timezone = `UTC${timezoneHours >= 0 ? "+" : ""}${Number.isInteger(timezoneHours) ? timezoneHours : timezoneHours.toFixed(1)}`;
  return {
    place: { ...place, timezone },
    current: toCurrent(currentPayload),
    hourly,
    daily,
    hourlyIntervalHours: 3,
    fetchedAt: new Date().toISOString(),
    source: "openweathermap",
  };
}

export async function fetchOpenWeatherTile(layer: string, z: number, x: number, y: number) {
  const allowed = new Set(["temp_new", "precipitation_new", "wind_new", "clouds_new"]);
  if (!allowed.has(layer) || ![z, x, y].every(Number.isInteger) || z < 0 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    throw new OpenWeatherError("Invalid weather map tile request.", 400);
  }
  const url = new URL(`https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png`);
  url.searchParams.set("appid", apiKey());
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate: 600 } });
  } catch {
    throw new OpenWeatherError("OpenWeather map tiles could not be reached.", 502);
  }
  if (!response.ok) {
    if (response.status === 401) throw new OpenWeatherError("OpenWeather rejected the API key for map tiles.", 401);
    throw new OpenWeatherError(`OpenWeather map tile request failed (${response.status}).`, response.status);
  }
  return response;
}

