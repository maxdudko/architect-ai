import type {
  ArchitectureModuleFile,
  ArchitectureModuleSummary,
  BoundDisclosure,
  DependencyMapEdge,
} from '@/entities';

const GROUP_PADDING = 16;
const GROUP_HEADER = 32;
const GROUP_GAP_X = 36;
const MODULE_WIDTH = 220;
const MODULE_GAP_Y = 12;
const MODULE_MIN_HEIGHT = 76;
const MODULE_MAX_HEIGHT = 132;
const EXPANDED_MODULE_WIDTH = 520;
const MODULE_HEADER = 56;
const TRUNCATION_LINE = 20;
const FILE_ROW_HEIGHT = 28;
const FILE_LIST_MAX_HEIGHT = 220;
const INNER_PADDING = 12;

export type DependencyFlowNodeKind = 'group' | 'module';

export interface DependencyFlowNode {
  id: string;
  kind: DependencyFlowNodeKind;
  parentId: string | null;
  position: { x: number; y: number };
  width: number;
  height: number;
  data: DependencyFlowNodeData;
}

export type DependencyFlowNodeData =
  | { kind: 'group'; label: string }
  | {
      kind: 'module';
      moduleKey: string;
      path: string;
      fileCount: number;
      outgoingDependencyCount: number;
      incomingDependencyCount: number;
      selected: boolean;
      filesTruncated: boolean;
      filesReturned: number;
      filesTotal: number;
      files: DependencyFlowFile[];
    };

export interface DependencyFlowFile {
  path: string;
  displayPath: string;
  language: string;
  href: string | null;
}

export interface DependencyFlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  fromModuleKey: string;
  toModuleKey: string;
}

export interface DependencyFlow {
  nodes: DependencyFlowNode[];
  edges: DependencyFlowEdge[];
}

export interface DependencyFlowInput {
  modules: ArchitectureModuleSummary[];
  dependencies: DependencyMapEdge[];
  filter: string;
  selectedModuleKey: string | null;
  files: ArchitectureModuleFile[];
  fileBounds: BoundDisclosure | null;
  fileHref?: (filePath: string) => string;
}

/**
 * Lays the repository out as groups of modules, with the selected module's
 * files nested inside its card. Positions are relative to each node's parent.
 */
export function toDependencyFlow(input: DependencyFlowInput): DependencyFlow {
  const needle = input.filter.trim().toLowerCase();
  const visibleModules = needle
    ? input.modules.filter((module) => module.path.toLowerCase().includes(needle))
    : input.modules;

  const visibleKeys = new Set(visibleModules.map((module) => module.key));
  const selectedKey =
    input.selectedModuleKey && visibleKeys.has(input.selectedModuleKey)
      ? input.selectedModuleKey
      : null;
  const maxFileCount = visibleModules.reduce((max, module) => Math.max(max, module.fileCount), 0);

  const groups = new Map<string, ArchitectureModuleSummary[]>();
  for (const summary of visibleModules) {
    const segment = summary.path.split('/')[0] || summary.path;
    const list = groups.get(segment);
    if (list) {
      list.push(summary);
    } else {
      groups.set(segment, [summary]);
    }
  }

  const nodes: DependencyFlowNode[] = [];
  let groupX = 0;

  for (const segment of [...groups.keys()].sort()) {
    const members = groups.get(segment) ?? [];
    const groupId = `group:${segment}`;
    const builtModules = members.map((module) =>
      buildModuleNode(module, groupId, selectedKey === module.key, maxFileCount, input),
    );

    let cursorY = GROUP_HEADER;
    let groupWidth = MODULE_WIDTH + GROUP_PADDING * 2;
    const groupChildren: DependencyFlowNode[] = [];
    for (const built of builtModules) {
      built.position = { x: GROUP_PADDING, y: cursorY };
      groupChildren.push(built);
      cursorY += built.height + MODULE_GAP_Y;
      groupWidth = Math.max(groupWidth, built.width + GROUP_PADDING * 2);
    }

    nodes.push(
      {
        id: groupId,
        kind: 'group',
        parentId: null,
        position: { x: groupX, y: 0 },
        width: groupWidth,
        height: cursorY - MODULE_GAP_Y + GROUP_PADDING,
        data: { kind: 'group', label: segment },
      },
      ...groupChildren,
    );
    groupX += groupWidth + GROUP_GAP_X;
  }

  const edges = input.dependencies
    .filter((edge) => visibleKeys.has(edge.fromModuleKey) && visibleKeys.has(edge.toModuleKey))
    .map((edge) => ({
      id: `${edge.fromModuleKey}::${edge.toModuleKey}`,
      source: `module:${edge.fromModuleKey}`,
      target: `module:${edge.toModuleKey}`,
      label: `${edge.supportingRelationCount} · resolved`,
      fromModuleKey: edge.fromModuleKey,
      toModuleKey: edge.toModuleKey,
    }));

  return { nodes, edges };
}

function buildModuleNode(
  summary: ArchitectureModuleSummary,
  parentId: string,
  selected: boolean,
  maxFileCount: number,
  input: DependencyFlowInput,
): DependencyFlowNode {
  let height = moduleCardHeight(summary.fileCount, maxFileCount);
  let width = MODULE_WIDTH;

  const bounds = selected ? input.fileBounds : null;
  const files = selected ? toFlowFiles(summary.path, input.files, input.fileHref) : [];

  if (selected && files.length > 0) {
    width = EXPANDED_MODULE_WIDTH;
    const listHeight = Math.min(FILE_LIST_MAX_HEIGHT, files.length * FILE_ROW_HEIGHT);
    const header = MODULE_HEADER + (bounds?.truncated ? TRUNCATION_LINE : 0);
    height = header + listHeight + INNER_PADDING;
  }

  return {
    id: `module:${summary.key}`,
    kind: 'module',
    parentId,
    position: { x: 0, y: 0 },
    width,
    height,
    data: {
      kind: 'module',
      moduleKey: summary.key,
      path: summary.path,
      fileCount: summary.fileCount,
      outgoingDependencyCount: summary.outgoingDependencyCount,
      incomingDependencyCount: summary.incomingDependencyCount,
      selected,
      filesTruncated: bounds?.truncated ?? false,
      filesReturned: bounds?.returned ?? 0,
      filesTotal: bounds?.total ?? 0,
      files,
    },
  };
}

function moduleCardHeight(fileCount: number, maxFileCount: number): number {
  if (maxFileCount <= 0) {
    return MODULE_MIN_HEIGHT;
  }
  const ratio = Math.min(fileCount / maxFileCount, 1);
  return Math.round(MODULE_MIN_HEIGHT + (MODULE_MAX_HEIGHT - MODULE_MIN_HEIGHT) * ratio);
}

function toFlowFiles(
  modulePath: string,
  files: ArchitectureModuleFile[],
  fileHref: DependencyFlowInput['fileHref'],
): DependencyFlowFile[] {
  const prefix = modulePath.endsWith('/') ? modulePath : `${modulePath}/`;
  return files
    .map((file) => {
      const relative = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
      return {
        path: file.path,
        displayPath: `/${relative}`,
        language: file.language,
        href: fileHref?.(file.path) ?? null,
      };
    })
    .sort((left, right) => left.displayPath.localeCompare(right.displayPath));
}
