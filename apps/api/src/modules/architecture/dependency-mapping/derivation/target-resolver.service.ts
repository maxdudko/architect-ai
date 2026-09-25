import { Injectable } from '@nestjs/common';
import { PROGRAMMING_LANGUAGES } from '../../../code-intelligence/types/programming-language.type';
import type { TargetResolution } from '../types/dependency-graph.type';
import { joinRelative, RepositoryFileIndex } from './repository-file-index';

/** Prefixes conventionally used for internal path aliases. */
const ALIAS_PREFIX_PATTERN = /^(@\/|~\/|#\/|\$\/)/;

/** A bare specifier that names a published package rather than a local path. */
const PACKAGE_SPECIFIER_PATTERN =
  /^(@[a-z0-9~][\w.-]*\/)?[a-z0-9~][\w.-]*(\/[\w.-]+)*$/i;

/** Node builtin modules, which are external by definition. */
const NODE_BUILTIN_PATTERN = /^(node:)/;

export interface TargetResolutionInput {
  sourceFilePath: string;
  /** Raw `SymbolRelation.targetFilePath` as written by the language pack. */
  observedTarget: string | null;
  language: string;
}

/**
 * Attributes a relationship target to an indexed file of the same revision, or
 * states why it could not (spec AD-5). This is the one new capability the
 * feature needs; it reads no source and adds no parsing pipeline.
 */
@Injectable()
export class TargetResolverService {
  resolve(
    input: TargetResolutionInput,
    fileIndex: RepositoryFileIndex,
  ): TargetResolution {
    const specifier = input.observedTarget?.trim();

    if (!specifier) {
      return { kind: 'UNRESOLVED', reason: 'NO_TARGET_PATH_RECORDED' };
    }

    if (NODE_BUILTIN_PATTERN.test(specifier)) {
      return { kind: 'EXTERNAL', targetName: specifier };
    }

    // Python specifiers are dotted module names, including the leading dots of
    // a package relative import, so they are read before the path-style rules.
    if (input.language === PROGRAMMING_LANGUAGES.python) {
      const pythonResolution = this.resolvePythonModule(
        input,
        specifier,
        fileIndex,
      );
      if (pythonResolution) {
        return pythonResolution;
      }
    }

    if (specifier.startsWith('.')) {
      return this.resolveRelative(input, specifier, fileIndex);
    }

    return this.resolveBare(specifier, fileIndex);
  }

  /**
   * A relative specifier addresses a path next to the source file, so failure
   * to find it means the target is genuinely absent from this revision.
   */
  private resolveRelative(
    input: TargetResolutionInput,
    specifier: string,
    fileIndex: RepositoryFileIndex,
  ): TargetResolution {
    const joined = joinRelative(input.sourceFilePath, specifier);
    if (!joined) {
      return { kind: 'UNRESOLVED', reason: 'RELATIVE_PATH_NOT_FOUND' };
    }

    const filePath = fileIndex.resolvePath(joined);
    if (filePath) {
      return { kind: 'RESOLVED', filePath, strategy: 'RELATIVE_PATH' };
    }

    return { kind: 'UNRESOLVED', reason: 'RELATIVE_PATH_NOT_FOUND' };
  }

  /**
   * Python `from a.b import c` records `a.b`. Leading dots mark a package
   * relative import. Absolute forms are tried from the repository root and
   * from each ancestor directory of the source file, since the package root is
   * not recorded during indexing.
   */
  private resolvePythonModule(
    input: TargetResolutionInput,
    specifier: string,
    fileIndex: RepositoryFileIndex,
  ): TargetResolution | null {
    const leadingDots = /^\.+/.exec(specifier)?.[0].length ?? 0;
    const dotted = specifier.slice(leadingDots);
    const modulePath = dotted.split('.').filter(Boolean).join('/');

    if (leadingDots > 0) {
      const upwards = '../'.repeat(Math.max(leadingDots - 1, 0));
      const joined = joinRelative(
        input.sourceFilePath,
        `${upwards}${modulePath}`,
      );
      if (joined) {
        const filePath = fileIndex.resolvePath(joined);
        if (filePath) {
          return {
            kind: 'RESOLVED',
            filePath,
            strategy: 'PYTHON_MODULE_PATH',
          };
        }
      }
      return { kind: 'UNRESOLVED', reason: 'RELATIVE_PATH_NOT_FOUND' };
    }

    if (!modulePath) {
      return null;
    }

    const ancestors = input.sourceFilePath.split('/').slice(0, -1);
    for (let depth = ancestors.length; depth >= 0; depth -= 1) {
      const prefix = ancestors.slice(0, depth).join('/');
      const candidate = prefix ? `${prefix}/${modulePath}` : modulePath;
      const filePath = fileIndex.resolvePath(candidate);
      if (filePath) {
        return { kind: 'RESOLVED', filePath, strategy: 'PYTHON_MODULE_PATH' };
      }
    }

    return null;
  }

  /**
   * A bare specifier is either an internal alias or a published package. It is
   * matched against indexed path suffixes; a single match resolves, several
   * matches are ambiguous, and no match falls back to the package test.
   *
   * A single-segment specifier carrying no alias prefix is never suffix
   * matched, because `uuid` matching a local `src/uuid.ts` would invent a
   * dependency that the source does not support (spec RS-4).
   */
  private resolveBare(
    specifier: string,
    fileIndex: RepositoryFileIndex,
  ): TargetResolution {
    const aliased = ALIAS_PREFIX_PATTERN.test(specifier);
    const withoutAlias = specifier.replace(ALIAS_PREFIX_PATTERN, '');
    const matchable = aliased || withoutAlias.includes('/');
    const matches = matchable ? fileIndex.matchSuffix(withoutAlias) : [];

    if (matches.length === 1) {
      return {
        kind: 'RESOLVED',
        filePath: matches[0],
        strategy: 'PATH_SUFFIX',
      };
    }

    if (matches.length > 1) {
      return { kind: 'UNRESOLVED', reason: 'AMBIGUOUS_MATCH' };
    }

    if (aliased) {
      return { kind: 'UNRESOLVED', reason: 'ALIAS_UNRESOLVED' };
    }

    const [firstSegment] = withoutAlias.split('/');
    if (firstSegment && fileIndex.hasRootSegment(firstSegment)) {
      return { kind: 'UNRESOLVED', reason: 'ALIAS_UNRESOLVED' };
    }

    if (PACKAGE_SPECIFIER_PATTERN.test(withoutAlias)) {
      return { kind: 'EXTERNAL', targetName: specifier };
    }

    return { kind: 'UNRESOLVED', reason: 'ALIAS_UNRESOLVED' };
  }
}
