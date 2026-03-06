import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnzuIngestion — Invoice Ingestion Platform",
  description:
    "Multi-channel invoice ingestion: web, email, and WhatsApp. Powered by Claude AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
