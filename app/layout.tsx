import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Board OS — Andreal & Anderson',
  description: 'CEO / Controller / Board control system for Andreal and Anderson',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
