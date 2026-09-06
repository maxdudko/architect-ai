import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';

const siteTitle = 'Architect AI | Engineering memory for software teams';
const siteDescription =
  'Architect AI turns a codebase into a searchable, source-cited context layer. Connect a repository, get living onboarding guides, and chat with your system to onboard without relying on tribal knowledge.';

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: [
    'AI onboarding',
    'developer onboarding',
    'codebase chat',
    'engineering memory',
    'architecture explorer',
    'AI code assistant',
    'BYOK LLM',
  ],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: 'website',
    siteName: 'Architect AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
