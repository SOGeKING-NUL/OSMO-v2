// Landing footer: wordmark, protocol tagline, app link.

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-black/5 px-6 py-8">
      <div className="flex flex-col items-center justify-between gap-4 text-xs tracking-wide text-gray-500 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#d95b21]" />
          </div>
          <span className="font-heading font-bold tracking-[0.2em] text-black">
            OSMO
          </span>
        </div>
        <p className="text-center">REDEMPTION IS NEVER PAUSABLE</p>
        <Link
          href="/app"
          className="font-medium text-gray-600 hover:text-black hover:underline"
        >
          LAUNCH APP →
        </Link>
      </div>
    </footer>
  );
}
