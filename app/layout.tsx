import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { UserProvider } from "@/components/user";
import "./globals.css";

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const sans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thinkstack",
  description: "Study from a lesson document you and the model can edit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <UserProvider>
          <AppHeader />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
