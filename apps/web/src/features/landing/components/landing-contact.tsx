'use client';

import { Check, Globe, Linkedin, Mail, Send } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { submitContactMessage } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { Button, Input, Loader, Textarea } from '@/shared/components';
import { SectionEyebrow } from './landing-ui';

function ProfileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string | null;
  icon: typeof Globe;
  label: string;
}) {
  const isDisabled = href == null;
  const className =
    'inline-flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-[hsl(var(--landing-accent)/.55)] hover:bg-accent';

  if (isDisabled) {
    return (
      <span
        className={`${className} cursor-not-allowed opacity-50 hover:border-border hover:bg-card`}
        title="Link coming soon"
      >
        <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
        {label}
      </span>
    );
  }

  const isHttp = href.startsWith('http://') || href.startsWith('https://');

  return (
    <a
      href={href}
      {...(isHttp ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={className}
    >
      <Icon className="size-4 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
      {label}
    </a>
  );
}

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();

    setError(null);
    setIsSubmitting(true);
    try {
      await submitContactMessage({ name, email, message });
      setSubmitted(true);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Unable to send your message. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  if (submitted) {
    return (
      <div className="flex min-h-[22rem] flex-col items-start justify-center rounded-xl border border-border bg-card p-6 md:p-8">
        <span className="flex size-10 items-center justify-center rounded-md border border-[hsl(var(--landing-accent)/.45)] bg-[hsl(var(--landing-accent)/.08)]">
          <Check className="size-5 text-[hsl(var(--landing-accent))]" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-xl font-medium">Message received.</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Thanks for writing. We&apos;ll reply soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col rounded-xl border border-border bg-card p-6 md:p-8"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            placeholder="Your name"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-message" className="text-sm font-medium">
            Message
          </label>
          <Textarea
            id="contact-message"
            name="message"
            required
            rows={5}
            placeholder="What do you want to talk about?"
            className="min-h-[8.5rem] resize-y"
            disabled={isSubmitting}
          />
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        className="mt-6 h-11 w-full gap-2 self-end sm:w-auto"
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader className="size-4" /> : null}
        Send message
        <Send className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );
}

export function ContactSection({
  creatorSiteUrl,
  creatorLinkedinUrl,
  creatorEmailUrl,
}: {
  creatorSiteUrl: string | null;
  creatorLinkedinUrl: string | null;
  creatorEmailUrl: string | null;
}) {
  return (
    <section
      id="contact"
      className="scroll-mt-20 border-b border-border/70 bg-accent/30 py-20 md:py-28"
    >
      <div className="container grid items-start gap-12 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <SectionEyebrow>Contact</SectionEyebrow>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Questions about the product?
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            Partnerships, self-hosting, or an enterprise conversation. Connecting a repository is
            still the fastest way to see whether it fits.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ProfileLink href={creatorSiteUrl} icon={Globe} label="Website" />
            <ProfileLink href={creatorLinkedinUrl} icon={Linkedin} label="LinkedIn" />
            <ProfileLink href={creatorEmailUrl} icon={Mail} label="Email" />
          </div>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
