import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--ws-line)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="font-display text-lg text-ws-text">WeatherSense</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-ws-muted">
            Current conditions and weather map layers are requested from OpenWeather.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ws-muted">
          <Link href="/" className="hover:text-ws-text">Overview</Link>
          <Link href="/#forecast" className="hover:text-ws-text">Forecast</Link>
          <Link href="/#maps" className="hover:text-ws-text">Maps</Link>
          <Link href="/#analytics" className="hover:text-ws-text">Analytics</Link>
          <Link href="/#assistant" className="hover:text-ws-text">Assistant</Link>
          <a href="https://openweathermap.org/api" className="hover:text-ws-text" target="_blank" rel="noreferrer">OpenWeather API</a>
        </div>
      </div>
    </footer>
  );
}
