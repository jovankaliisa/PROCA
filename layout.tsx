import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROCA | Control Center",
  description: "Enterprise school device management and kiosk control.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
