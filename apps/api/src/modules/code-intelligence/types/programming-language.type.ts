export const PROGRAMMING_LANGUAGES = {
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  php: 'php',
  go: 'go',
  java: 'java',
  rust: 'rust',
} as const;

export type ProgrammingLanguage =
  (typeof PROGRAMMING_LANGUAGES)[keyof typeof PROGRAMMING_LANGUAGES];
