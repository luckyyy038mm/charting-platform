import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charting Platform | Professional Crypto Trading Charts',
  description: 'Professional charting platform for crypto markets with real-time data, order flow, and advanced analysis tools.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
