import { NextResponse } from "next/server";
import { OpenWeatherError, searchOpenWeatherPlaces } from "@/lib/openweather";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) return NextResponse.json({ places: [] });
  try {
    return NextResponse.json({ places: await searchOpenWeatherPlaces(query) }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    const failure = error instanceof OpenWeatherError ? error : new OpenWeatherError("Location search failed.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
