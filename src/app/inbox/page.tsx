import Link from "next/link";

export default function InboxPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <header className="shrink-0 border-b-2 border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center rounded-none border-2 border-black bg-white px-3 py-1 text-sm font-bold text-black shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
            aria-label="Back to feed"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-black">Inbox</h1>
          <span className="w-12" aria-hidden />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-12 text-center">
          <div className="mx-auto w-fit rounded-none border-2 border-black bg-white px-6 py-6 shadow-[3px_3px_0px_black]">
            <p className="text-sm font-bold text-black">Inbox — coming soon.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
