import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { neonAuth } from "@neondatabase/auth/next/server";
import { LogoutButton } from "./logout-button";
import { isAdmin } from "@/lib/admin";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Body Scan — Estimate Body Fat % from Photos",
  description:
    "Estimate your body fat percentage and measurements from front and profile body photos using AI.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await neonAuth();
  const admin = user ? await isAdmin(user.id) : false;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-300">
        <nav className="sticky top-0 z-50 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="group flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Body Scan
              </Link>
              <div className="flex items-center gap-6 text-sm font-medium">
                <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-primary">
                  Dashboard
                </Link>
                <Link href="/scan/new" className="text-muted-foreground transition-colors hover:text-primary">
                  New Scan
                </Link>
                <Link href="/profile" className="text-muted-foreground transition-colors hover:text-primary">
                  Profile
                </Link>
                {admin && (
                  <>
                    <span className="h-4 w-px bg-border" aria-hidden />
                    <Link href="/admin/training" className="text-muted-foreground transition-colors hover:text-primary">
                      Training
                    </Link>
                    <Link href="/admin/optimize" className="text-muted-foreground transition-colors hover:text-primary">
                      Optimize
                    </Link>
                  </>
                )}
              </div>
            </div>
            <LogoutButton />
          </div>
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
