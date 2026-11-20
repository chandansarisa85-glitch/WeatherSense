import { OpenWeatherError, fetchOpenWeatherTile } from "@/lib/openweather";

export async function GET(_request: Request, { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }) {
  const values = await params;
  try {
    const tile = await fetchOpenWeatherTile(values.layer, Number(values.z), Number(values.x), Number(values.y));
    return new Response(tile.body, {
      headers: {
        "Content-Type": tile.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const failure = error instanceof OpenWeatherError ? error : new OpenWeatherError("Weather map tile failed.");
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
