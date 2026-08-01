import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { rehypeStableHeadingSlugs } from '../utils/markdown-headings';

const components: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn('mt-10 scroll-mt-24 text-3xl font-semibold tracking-tight', className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        'mt-10 scroll-mt-24 border-b pb-2 text-2xl font-semibold tracking-tight',
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('mt-8 scroll-mt-24 text-xl font-semibold', className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn('mt-6 scroll-mt-24 text-lg font-semibold', className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn('my-4 leading-7 text-foreground/90', className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn('my-4 ml-6 list-disc space-y-2', className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn('my-4 ml-6 list-decimal space-y-2', className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn('my-5 border-l-4 border-border pl-4 italic text-muted-foreground', className)}
      {...props}
    />
  ),
  a: ({ className, href, ...props }) => {
    const external = href?.startsWith('http://') || href?.startsWith('https://');
    return (
      <a
        className={cn('font-medium text-[#29903B] underline underline-offset-4', className)}
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        {...props}
      />
    );
  },
  code: ({ className, ...props }) => (
    <code
      className={cn(
        'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] before:content-none after:content-none',
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        'my-5 overflow-x-auto rounded-lg border bg-muted/60 p-4 text-sm [&>code]:bg-transparent [&>code]:p-0',
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-6 overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th className={cn('border bg-muted px-3 py-2 text-left font-semibold', className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn('border px-3 py-2 align-top', className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn('my-8 border-border', className)} {...props} />
  ),
};

export function GuideMarkdown({ markdown }: { markdown: string }) {
  return (
    <article className="min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeStableHeadingSlugs]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
