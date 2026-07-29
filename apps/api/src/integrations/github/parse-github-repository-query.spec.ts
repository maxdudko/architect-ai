import { BadRequestException } from '@nestjs/common';
import { parseGithubRepositoryQuery } from './parse-github-repository-query';

describe('parseGithubRepositoryQuery', () => {
  it('parses owner/repo slugs', () => {
    expect(parseGithubRepositoryQuery('facebook/react')).toEqual({
      owner: 'facebook',
      name: 'react',
    });
  });

  it('parses https GitHub URLs', () => {
    expect(
      parseGithubRepositoryQuery('https://github.com/facebook/react'),
    ).toEqual({
      owner: 'facebook',
      name: 'react',
    });
  });

  it('strips .git suffix and tree paths', () => {
    expect(
      parseGithubRepositoryQuery('https://github.com/facebook/react.git'),
    ).toEqual({
      owner: 'facebook',
      name: 'react',
    });
    expect(
      parseGithubRepositoryQuery(
        'https://github.com/facebook/react/tree/main/packages',
      ),
    ).toEqual({
      owner: 'facebook',
      name: 'react',
    });
  });

  it('accepts www.github.com hosts', () => {
    expect(
      parseGithubRepositoryQuery('https://www.github.com/acme/platform'),
    ).toEqual({
      owner: 'acme',
      name: 'platform',
    });
  });

  it('rejects empty and invalid inputs', () => {
    expect(() => parseGithubRepositoryQuery('')).toThrow(BadRequestException);
    expect(() => parseGithubRepositoryQuery('not-a-repo')).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseGithubRepositoryQuery('https://gitlab.com/acme/platform'),
    ).toThrow(BadRequestException);
    expect(() =>
      parseGithubRepositoryQuery('https://github.com/only-owner'),
    ).toThrow(BadRequestException);
  });
});
