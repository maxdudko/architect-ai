export const PROGRAMMING_LANGUAGES = {
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  php: 'php',
  go: 'go',
  java: 'java',
  rust: 'rust',
  config: 'config',
} as const;

export type ProgrammingLanguage =
  (typeof PROGRAMMING_LANGUAGES)[keyof typeof PROGRAMMING_LANGUAGES];

export function isSourceLanguage(
  language: string,
): language is Exclude<ProgrammingLanguage, 'config'> {
  return language !== PROGRAMMING_LANGUAGES.config;
}
