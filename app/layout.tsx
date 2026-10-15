// app/layout.tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Each font becomes a CSS variable, which globals.css hands to Tailwind.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Compliance Tracker",
  description: "Track your compliance certificates and their expiry dates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-canvas text-ink min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
