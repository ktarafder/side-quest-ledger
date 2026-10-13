import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Side Quest Ledger",
  description: "Small missions. Real life. Worth doing.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
