import Link from "next/link";

export function BackButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
    >
      <span aria-hidden>&larr;</span> Tillbaka
    </Link>
  );
}
