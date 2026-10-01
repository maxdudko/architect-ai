'use client';

import Link from 'next/link';
import { useCallback, type SyntheticEvent } from 'react';
import { BrandMark } from '@/shared/components';
import { AudienceSection } from './landing-audience';
import { ArchitectureExplorerPreview } from './landing-architecture';
import { FinalCta } from './landing-cta';
import { ContactSection } from './landing-contact';
import { DifferentiationSection } from './landing-differentiation';
import { FaqSection } from './landing-faq';
import { GroundedAnswers } from './landing-grounded';
import { LandingHero } from './landing-hero';
import { HowItWorks } from './landing-how-it-works';
import { ModelAgnostic } from './landing-model';
import { ProductPillars } from './landing-pillars';
import { LandingPlansSection } from './landing-plans';
import { ProblemSection } from './landing-problem';
import { SecuritySection } from './landing-security';
import { GitHubLink } from './landing-ui';
import { VisionSection } from './landing-vision';

const NAVBAR_OFFSET = 80;

const navItems = [
  ['product', 'Product'],
  ['architecture', 'Architecture'],
  ['how-it-works', 'How it works'],
  ['security', 'Security'],
  ['vision', 'Vision'],
  ['plans', 'Plans'],
  ['faq', 'FAQ'],
] as const;

export function LandingPage({
  isAuthenticated = false,
  creatorSiteUrl = null,
  creatorLinkedinUrl = null,
  creatorEmailUrl = null,
  githubRepoUrl = null,
}: {
  isAuthenticated?: boolean;
  creatorSiteUrl?: string | null;
  creatorLinkedinUrl?: string | null;
  creatorEmailUrl?: string | null;
  githubRepoUrl?: string | null;
}) {
  const handleNavClick = useCallback((event: SyntheticEvent, link: string) => {
    event.preventDefault();

    const sectionId = link.trim().toLowerCase();
    const section = document.getElementById(sectionId);
    if (!section) return;

    const top =
      sectionId === 'top'
        ? 0
        : section.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: 'smooth',
    });

    window.history.pushState(
      null,
      '',
      sectionId === 'top' ? window.location.pathname : `#${sectionId}`,
    );
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div id="top" className="h-0 w-0 overflow-hidden" aria-hidden="true" />
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <a href="#top" onClick={(event) => handleNavClick(event, 'top')}>
            <BrandMark />
          </a>
          <nav
            className="hidden items-center gap-5 text-sm text-muted-foreground md:flex"
            aria-label="Main navigation"
          >
            {navItems.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(event) => handleNavClick(event, id)}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <GitHubLink
              className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
              iconClassName="size-4"
              href={githubRepoUrl}
            />
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-md bg-[#29903B] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
                >
                  Sign up
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-9 items-center rounded-md bg-[#29903B] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <LandingHero isAuthenticated={isAuthenticated} onNavigate={handleNavClick} />
      <ProblemSection />
      <ProductPillars />
      <ArchitectureExplorerPreview />
      <HowItWorks />
      <GroundedAnswers />
      <ModelAgnostic />
      <SecuritySection />
      <DifferentiationSection />
      <AudienceSection />
      <VisionSection />
      <LandingPlansSection isAuthenticated={isAuthenticated} />
      <FaqSection isGithubPublic={githubRepoUrl != null} />
      <FinalCta isAuthenticated={isAuthenticated} />
      <ContactSection
        creatorSiteUrl={creatorSiteUrl}
        creatorLinkedinUrl={creatorLinkedinUrl}
        creatorEmailUrl={creatorEmailUrl}
      />

      <footer className="py-8">
        <div className="container flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <p className="font-mono">Architect AI · AI codebase intelligence</p>
          <p>© {new Date().getFullYear()} Architect AI. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
