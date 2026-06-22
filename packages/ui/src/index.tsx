import type { PropsWithChildren } from 'react';

type StatusCardProps = PropsWithChildren<{
  title: string;
}>;

export function StatusCard({ title, children }: StatusCardProps) {
  return (
    <section>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
