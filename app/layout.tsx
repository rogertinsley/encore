import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, DM_Mono } from "next/font/google";
import { AppChrome } from "./components/AppChrome";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-encore",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Encore",
  description: "Personal music discovery",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${atkinson.variable} ${dmMono.variable}`}>
      <body className="min-h-screen">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
