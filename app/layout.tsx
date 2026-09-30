import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MakerHeat — observed tape concentration",
  description:
    "See who supplied the observed buy/sell volume on a DEX pair, and how much the sample can explain. Descriptive, replayable, honest about scope.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
