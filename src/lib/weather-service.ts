import type { Place, WeatherSnapshot } from "@/lib/types";

async function readJson<T>(url: string, label: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error(`${label} could not be reached. Check your connection and try again.`);
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `${label} failed (${response.status}).`);
  return payload as T;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const params = new URLSearchParams({ q: name });
  const payload = await readJson<{ places: Place[] }>(`/api/weather/places?${params}`, "Location search");
  return payload.places ?? [];
}

export async function reversePlace(latitude: number, longitude: number): Promise<Place> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const payload = await readJson<{ place: Place }>(`/api/weather/reverse?${params}`, "Location lookup");
  return payload.place;
}

export async function fetchWeather(place: Place): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    lat: String(place.latitude),
    lon: String(place.longitude),
    name: place.name,
    country: place.country,
    id: String(place.id),
  });
  return readJson<WeatherSnapshot>(`/api/weather/forecast?${params}`, "Weather forecast");
}
