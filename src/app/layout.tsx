import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Chat.buzzi.ai - Multi-Tenant AI Customer Support Platform",
    template: "%s | Chat.buzzi.ai",
  },
  description:
    "AI-powered customer support platform with multi-tenant capabilities, knowledge base management, and real-time chat.",
  keywords: [
    "AI chatbot",
    "customer support",
    "multi-tenant",
    "SaaS",
    "knowledge base",
    "chat widget",
  ],
  authors: [{ name: "Buzzi.ai" }],
  creator: "Buzzi.ai",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Chat.buzzi.ai",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
