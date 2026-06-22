export type ServiceHealth = {
  status: 'ok' | 'degraded' | 'down';
  service: string;
};

export function formatServiceHealth(health: ServiceHealth): string {
  return `${health.service}:${health.status}`;
}
