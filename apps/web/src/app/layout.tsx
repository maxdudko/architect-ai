import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';

const siteTitle = 'Architect AI | AI codebase intelligence';
const siteDescription =
  'Architect AI turns repositories into searchable engineering context. Ask questions, explore architecture, and generate onboarding guides grounded in your code.';

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: [
    'codebase intelligence',
    'repository Q&A',
    'architecture explorer',
    'developer onboarding',
    'source-grounded answers',
    'BYOK LLM',
    'self-hosted AI',
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
