import { BadRequestException } from '@nestjs/common';

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Extracts owner/name from a GitHub URL or `owner/repo` slug.
 * Accepts https://github.com/owner/repo(.git)? and paths after the repo (e.g. /tree/...).
 */
export function parseGithubRepositoryQuery(query: string): {
  owner: string;
  name: string;
} {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new BadRequestException(
      'Provide a GitHub repository URL or owner/repo',
    );
  }

  let candidate = trimmed;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
        throw new BadRequestException(
          'Only github.com repository URLs are supported',
        );
      }
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length < 2) {
        throw new BadRequestException(
          'GitHub URL must include owner and repository name',
        );
      }
      candidate = `${segments[0]}/${segments[1]}`;
    }
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Invalid GitHub repository URL');
  }

  candidate = candidate.replace(/\.git$/i, '');

  if (!OWNER_REPO_PATTERN.test(candidate)) {
    throw new BadRequestException(
      'Provide a GitHub repository URL or owner/repo',
    );
  }

  const [owner, name] = candidate.split('/');
  return { owner, name };
}
