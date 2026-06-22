export type LlmProvider = 'openai' | 'anthropic';

export function providerLabel(provider: LlmProvider): string {
  return `provider:${provider}`;
}
