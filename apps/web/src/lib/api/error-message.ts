import { isAxiosError } from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) {
    return fallback;
  }

  const payload = error.response?.data as
    | {
        error?: { message?: string | string[]; code?: string } | string;
        message?: string | string[];
      }
    | undefined;

  const nestedError = payload?.error;
  const fromNested =
    nestedError && typeof nestedError === 'object'
      ? nestedError.message
      : typeof nestedError === 'string'
        ? nestedError
        : undefined;
  const message = fromNested ?? payload?.message;
  if (Array.isArray(message)) {
    return message.join(', ') || fallback;
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
}
