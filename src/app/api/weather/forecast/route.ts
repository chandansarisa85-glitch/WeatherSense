import { NextResponse } from "next/server";
import { fetchOpenWeatherSnapshot, OpenWeatherError } from "@/lib/openweather";
import type { Place } from "@/lib/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  const name = params.get("name")?.slice(0, 100).trim();
  const country = params.get("country")?.slice(0, 80) ?? "";
  const admin1 = params.get("admin1")?.slice(0, 80) || undefined;
  const id = Number(params.get("id"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !name) {
    return NextResponse.json({ error: "A valid place is required." }, { status: 400 });
  }
  const place: Place = { id: Number.isFinite(id) ? id : 0, name, country, admin1, latitude, longitude };
  try {
    return NextResponse.json(await fetchOpenWeatherSnapshot(place), { headers: { "Cache-Control": "private, max-age=180" } });
  } catch (error) {
    const failure = error instanceof OpenWeatherError ? error : new OpenWeatherError("Weather request failed.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
