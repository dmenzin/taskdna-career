import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskDNA Career",
  description: "Sandbox career-discovery prototype based on actual work structure.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
