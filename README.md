# WeatherSense

Weather intelligence dashboard powered by the OpenWeather current weather, five-day forecast, geocoding, and map tile APIs.

## Run locally

1. Copy `.env.example` to `.env.local`.

2. Set `OPENWEATHER_API_KEY` in `.env.local` to an active OpenWeather key. Keep it server-side; do not rename it with a `NEXT_PUBLIC_` prefix.
3. Run `npm install`, then `npm run dev` and open [http://localhost:3000](http://localhost:3000).

OpenWeather requests are proxied through Next.js route handlers. The browser receives normalized forecast data and map images, never the API key.

The standard OpenWeather forecast endpoint provides five days in three-hour intervals. UV and historical readings are not included, so the dashboard marks UV unavailable and the assistant does not invent historical comparisons.

## Production build

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Start the built app with `npm run start`.
