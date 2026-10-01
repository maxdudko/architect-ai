import { Injectable } from '@nestjs/common';
import {
  MODULE_EXCLUSION_PATTERN,
  MODULE_MAX_PATH_SEGMENTS,
  MODULE_MIN_FILE_COUNT,
} from '../dependency-map.constants';
import type {
  ArchitectureSnapshotFile,
  ArchitectureSnapshotSymbolCount,
} from '../types/architecture-snapshot.type';
import type { ModuleExclusionSummary } from '../types/dependency-graph.type';

/** Module key used for files that sit directly in the repository root. */
export const ROOT_MODULE_KEY = '.';

export interface GroupedModule {
  key: string;
  name: string;
  path: string;
  filePaths: string[];
  fileCount: number;
  symbolCount: number;
  lineCount: number;
  languages: string[];
}

export interface ModuleGroupingResult {
  modules: GroupedModule[];
  /** Every grouped file mapped to the module that owns it. */
  moduleKeyByFilePath: Map<string, string>;
  exclusions: ModuleExclusionSummary[];
  groupedFileCount: number;
  excludedFileCount: number;
}

const EXCLUSION_REASON_PATTERN =
  'Folder path matches an excluded pattern (test, spec, fixture, vendor, generated, dist, build, node_modules)';
const EXCLUSION_REASON_TOO_SMALL = `Folder holds fewer than ${MODULE_MIN_FILE_COUNT} indexed files`;

/**
 * Groups the indexed files of one revision into modules (spec FR-2).
 *
 * The rules mirror the onboarding topology analyzer so both surfaces describe
 * the same boundaries, but grouping here is exhaustive: nothing is capped, and
 * every dropped file is accounted for with a stated reason.
 */
@Injectable()
export class ModuleGrouperService {
  group(
    files: ArchitectureSnapshotFile[],
    symbolCounts: ArchitectureSnapshotSymbolCount[],
  ): ModuleGroupingResult {
    const symbolCountByFile = new Map(
      symbolCounts.map((entry) => [entry.filePath, entry.count]),
    );

    const buckets = new Map<string, GroupedModule>();
    let excludedByPattern = 0;

    for (const file of files) {
      const key = moduleKeyFor(file.path);

      if (key !== ROOT_MODULE_KEY && MODULE_EXCLUSION_PATTERN.test(key)) {
        excludedByPattern += 1;
        continue;
      }

      const bucket = buckets.get(key) ?? {
        key,
        name: humanize(key),
        path: key,
        filePaths: [],
        fileCount: 0,
        symbolCount: 0,
        lineCount: 0,
        languages: [],
      };

      bucket.filePaths.push(file.path);
      bucket.fileCount += 1;
      bucket.lineCount += file.lineCount;
      bucket.symbolCount += symbolCountByFile.get(file.path) ?? 0;
      if (!bucket.languages.includes(file.language)) {
        bucket.languages.push(file.language);
      }

      buckets.set(key, bucket);
    }

    const modules: GroupedModule[] = [];
    const moduleKeyByFilePath = new Map<string, string>();
    let excludedAsTooSmall = 0;

    for (const bucket of buckets.values()) {
      if (bucket.fileCount < MODULE_MIN_FILE_COUNT) {
        excludedAsTooSmall += bucket.fileCount;
        continue;
      }

      bucket.filePaths.sort();
      bucket.languages.sort();
      modules.push(bucket);

      for (const filePath of bucket.filePaths) {
        moduleKeyByFilePath.set(filePath, bucket.key);
      }
    }

    modules.sort((left, right) => left.key.localeCompare(right.key));

    const exclusions: ModuleExclusionSummary[] = [];
    if (excludedByPattern > 0) {
      exclusions.push({
        reason: EXCLUSION_REASON_PATTERN,
        fileCount: excludedByPattern,
      });
    }
    if (excludedAsTooSmall > 0) {
      exclusions.push({
        reason: EXCLUSION_REASON_TOO_SMALL,
        fileCount: excludedAsTooSmall,
      });
    }

    return {
      modules,
      moduleKeyByFilePath,
      exclusions,
      groupedFileCount: moduleKeyByFilePath.size,
      excludedFileCount: excludedByPattern + excludedAsTooSmall,
    };
  }
}

/**
 * The leading folder path of at most two segments. Files directly in the
 * repository root collapse into a single root module.
 */
export function moduleKeyFor(filePath: string): string {
  const segments = filePath.split('/');
  if (segments.length <= 1) {
    return ROOT_MODULE_KEY;
  }
  return segments
    .slice(0, Math.min(MODULE_MAX_PATH_SEGMENTS, segments.length - 1))
    .join('/');
}

function humanize(value: string): string {
  if (value === ROOT_MODULE_KEY) {
    return 'Repository root';
  }
  const last = value.split('/').at(-1) ?? value;
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
