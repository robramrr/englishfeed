import Link from "next/link";

export default function InboxPage() {
  return (
    <div className="flex min-h-[var(--feed-viewport-height)] flex-col text-brand-navy">
      <header className="shrink-0 comic-border-b-4 comic-bg-header-stripes px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center rounded-none comic-border bg-white px-3 py-1 text-sm font-bold text-brand-navy comic-shadow-sm transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            aria-label="Back to feed"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-brand-navy">Inbox</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-12 text-center">
          <div className="mx-auto w-fit rounded-none comic-border bg-white px-6 py-6 comic-shadow-sm">
            <p className="text-sm font-bold text-brand-navy">Inbox — coming soon.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
