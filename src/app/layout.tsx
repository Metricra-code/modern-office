import type { Metadata, Viewport } from 'next';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/urbanist/latin-500.css';
import '@fontsource/urbanist/latin-600.css';
import '@fontsource/urbanist/latin-700.css';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100'),
  title: { default: 'Modern Office — Spatial collaboration', template: '%s · Modern Office' },
  description:
    'An interactive virtual office with live guest presence, chat and one-to-one video. Built with Next.js, TypeScript and Bun.',
  icons: { icon: `${basePath}/favicon.svg` },
  openGraph: {
    title: 'Modern Office — Spatial collaboration',
    description:
      'Explore a virtual office, invite another guest, and try live chat and video without an account.',
    type: 'website',
    images: [
      {
        url: `${basePath}/social-card.png`,
        width: 1200,
        height: 630,
        alt: 'Modern Office, a spatial collaboration workspace',
      },
    ],
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f7f2' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
