import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/scraper", label: "Scraper" },
  { href: "/outreach", label: "Outreach" },
];

export function SiteNav() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Lead Machine
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-1 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
