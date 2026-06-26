import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WrongToStrong",
  description: "A delayed-review error log for standardized test prep."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
