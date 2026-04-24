import Link from "next/link";

export default function TicketNotFound() {
  return (
    <div className="min-h-full flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Ticket Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">
          This ticket doesn&apos;t exist or may have been deleted during a database reset.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/tickets"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ← Back to Inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
