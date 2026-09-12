import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider, themeScript } from '@/components/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'StudyMate', template: '%s · StudyMate' },
  description:
    'Your academic command centre. Capture class material, turn it into tasks, and know what to do when you get home.',
  applicationName: 'StudyMate',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Background matches the canvas token so the browser chrome blends in.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f8f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      // themeScript below stamps the `dark` class on this element before React
      // hydrates, so the server's class attribute deliberately does not match
      // the client's. Without this, every visitor whose resolved theme is dark
      // -- including everyone on the default "system" setting with a dark OS --
      // gets a hydration mismatch error. Scoped to this element's own
      // attributes; it does not silence mismatches anywhere else in the tree.
      suppressHydrationWarning
    >
      <head>
        {/* Blocking, pre-paint: sets the theme class before first render so the
            page never flashes light before switching to dark. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
