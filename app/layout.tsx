import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Lightbulb, Settings } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram Analytics",
  description: "Organic and paid Instagram analytics from the Meta API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <BarChart3 className="h-5 w-5" />
              Instagram Analytics
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 hover:bg-accent"
              >
                Dashboard
              </Link>
              <Link
                href="/insights"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent"
              >
                <Lightbulb className="h-4 w-4" />
                Insights
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-accent"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
