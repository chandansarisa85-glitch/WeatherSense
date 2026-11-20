import { NextResponse } from "next/server";
import { OpenWeatherError, reverseOpenWeatherPlace } from "@/lib/openweather";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "A valid latitude and longitude are required." }, { status: 400 });
  }
  try {
    return NextResponse.json({ place: await reverseOpenWeatherPlace(latitude, longitude) }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    const failure = error instanceof OpenWeatherError ? error : new OpenWeatherError("Location lookup failed.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
