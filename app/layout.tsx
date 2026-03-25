import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono, Barlow } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  variable: "--font-mono",
  subsets: ["latin"],
});

const barlow = Barlow({
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CPP Painting & Building | Reno, NV",
  description:
    "Production-grade interior painting, exterior painting, and epoxy floors in Reno, NV. Licensed and insured.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bebas.variable} ${mono.variable} ${barlow.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
