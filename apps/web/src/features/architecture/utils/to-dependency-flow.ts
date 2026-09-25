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
const EXPANDED_MODULE_WIDTH = 280;
const MODULE_HEADER = 64;
const FOLDER_HEADER = 28;
const FILE_ROW_HEIGHT = 26;
const INNER_PADDING = 12;

export type DependencyFlowNodeKind = 'group' | 'module' | 'folder' | 'file';

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
    }
  | { kind: 'folder'; label: string }
  | { kind: 'file'; path: string; language: string; lineCount: number };

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
      built.module.position = { x: GROUP_PADDING, y: cursorY };
      groupChildren.push(built.module, ...built.children);
      cursorY += built.module.height + MODULE_GAP_Y;
      groupWidth = Math.max(groupWidth, built.module.width + GROUP_PADDING * 2);
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
      label: String(edge.supportingRelationCount),
      fromModuleKey: edge.fromModuleKey,
      toModuleKey: edge.toModuleKey,
    }));

  return { nodes, edges };
}

interface BuiltModule {
  module: DependencyFlowNode;
  children: DependencyFlowNode[];
}

function buildModuleNode(
  summary: ArchitectureModuleSummary,
  parentId: string,
  selected: boolean,
  maxFileCount: number,
  input: DependencyFlowInput,
): BuiltModule {
  const moduleId = `module:${summary.key}`;
  const children: DependencyFlowNode[] = [];
  let height = moduleCardHeight(summary.fileCount, maxFileCount);
  let width = MODULE_WIDTH;

  if (selected) {
    width = EXPANDED_MODULE_WIDTH;
    const folders = groupFiles(summary.path, input.files);
    let cursorY = MODULE_HEADER;
    const innerWidth = EXPANDED_MODULE_WIDTH - INNER_PADDING * 2;
    for (const folder of folders) {
      const folderId = `folder:${summary.key}:${folder.label}`;
      const folderHeight = FOLDER_HEADER + folder.files.length * FILE_ROW_HEIGHT;
      children.push({
        id: folderId,
        kind: 'folder',
        parentId: moduleId,
        position: { x: INNER_PADDING, y: cursorY },
        width: innerWidth,
        height: folderHeight,
        data: { kind: 'folder', label: folder.label },
      });
      folder.files.forEach((file, index) => {
        children.push({
          id: `file:${file.path}`,
          kind: 'file',
          parentId: folderId,
          position: { x: 0, y: FOLDER_HEADER + index * FILE_ROW_HEIGHT },
          width: innerWidth,
          height: FILE_ROW_HEIGHT,
          data: {
            kind: 'file',
            path: file.path,
            language: file.language,
            lineCount: file.lineCount,
          },
        });
      });
      cursorY += folderHeight + 8;
    }
    height = Math.max(height, cursorY + INNER_PADDING);
  }

  const bounds = selected ? input.fileBounds : null;

  return {
    module: {
      id: moduleId,
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
      },
    },
    children,
  };
}

function moduleCardHeight(fileCount: number, maxFileCount: number): number {
  if (maxFileCount <= 0) {
    return MODULE_MIN_HEIGHT;
  }
  const ratio = Math.min(fileCount / maxFileCount, 1);
  return Math.round(MODULE_MIN_HEIGHT + (MODULE_MAX_HEIGHT - MODULE_MIN_HEIGHT) * ratio);
}

interface FileFolder {
  label: string;
  files: ArchitectureModuleFile[];
}

function groupFiles(modulePath: string, files: ArchitectureModuleFile[]): FileFolder[] {
  const prefix = modulePath.endsWith('/') ? modulePath : `${modulePath}/`;
  const byFolder = new Map<string, ArchitectureModuleFile[]>();

  for (const file of files) {
    const relative = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
    const slash = relative.indexOf('/');
    const label = slash === -1 ? 'root' : relative.slice(0, slash);
    const list = byFolder.get(label);
    if (list) {
      list.push(file);
    } else {
      byFolder.set(label, [file]);
    }
  }

  return [...byFolder.keys()]
    .sort((left, right) => {
      if (left === 'root') return -1;
      if (right === 'root') return 1;
      return left.localeCompare(right);
    })
    .map((label) => ({ label, files: byFolder.get(label) ?? [] }));
}
