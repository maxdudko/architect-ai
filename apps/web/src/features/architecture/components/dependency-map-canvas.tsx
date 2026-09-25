'use client';

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useTheme } from 'next-themes';
import '@xyflow/react/dist/style.css';
import type { DependencyFlowEdge, DependencyFlowNodeData } from '../utils/to-dependency-flow';
import { formatCount } from '../utils/dependency-map-presentation';

interface DependencyMapCanvasProps {
  nodes: Array<{
    id: string;
    kind: DependencyFlowNodeData['kind'];
    parentId: string | null;
    position: { x: number; y: number };
    width: number;
    height: number;
    data: DependencyFlowNodeData;
  }>;
  edges: DependencyFlowEdge[];
  onSelectModule: (moduleKey: string) => void;
  onInspectDependency: (dependency: { from: string; to: string }) => void;
}

const nodeTypes = {
  structureGroup: StructureGroup,
  moduleCard: ModuleCard,
  folderLabel: FolderLabel,
  fileRow: FileRow,
};

export function DependencyMapCanvas({
  nodes,
  edges,
  onSelectModule,
  onInspectDependency,
}: DependencyMapCanvasProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="h-[36rem] w-full overflow-hidden rounded-md border border-border/70">
      <ReactFlow
        nodes={toFlowNodes(nodes)}
        edges={toFlowEdges(edges)}
        nodeTypes={nodeTypes}
        colorMode={resolvedTheme === 'light' ? 'light' : 'dark'}
        fitView
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => {
          const data = node.data as DependencyFlowNodeData;
          if (data.kind === 'module') {
            onSelectModule(data.moduleKey);
          }
        }}
        onEdgeClick={(_, edge) => {
          const data = edge.data as DependencyFlowEdge | undefined;
          if (data) {
            onInspectDependency({ from: data.fromModuleKey, to: data.toModuleKey });
          }
        }}
      >
        <Background gap={18} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function toFlowNodes(nodes: DependencyMapCanvasProps['nodes']): Node<DependencyFlowNodeData>[] {
  return nodes.map((node) => ({
    id: node.id,
    type:
      node.kind === 'group'
        ? 'structureGroup'
        : node.kind === 'module'
          ? 'moduleCard'
          : node.kind === 'folder'
            ? 'folderLabel'
            : 'fileRow',
    parentId: node.parentId ?? undefined,
    position: node.position,
    data: node.data,
    width: node.width,
    height: node.height,
    style: { width: node.width, height: node.height },
    draggable: false,
    selectable: false,
    connectable: false,
    extent: node.parentId ? 'parent' : undefined,
  }));
}

function toFlowEdges(edges: DependencyFlowEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep' as const,
    data: { ...edge },
  }));
}

function StructureGroup({ data }: NodeProps) {
  const node = data as DependencyFlowNodeData;
  const label = node.kind === 'group' ? node.label : '';
  return (
    <div className="h-full w-full rounded-xl border border-border bg-muted/30">
      <p className="px-3 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ModuleCard({ data }: NodeProps) {
  const node = data as DependencyFlowNodeData;
  if (node.kind !== 'module') {
    return null;
  }
  return (
    <div
      className={`flex h-full w-full cursor-pointer flex-col rounded-lg border bg-card px-3 py-2 text-left ${
        node.selected ? 'border-foreground' : 'border-border hover:border-foreground/40'
      }`}
    >
      <p className="truncate text-sm font-medium">{node.path}</p>
      <p className="text-xs text-muted-foreground">
        {formatCount(node.fileCount, 'file')} · {node.outgoingDependencyCount} out ·{' '}
        {node.incomingDependencyCount} in
      </p>
      {node.filesTruncated ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Showing {node.filesReturned} of {node.filesTotal} files.
        </p>
      ) : null}
    </div>
  );
}

function FolderLabel({ data }: NodeProps) {
  const node = data as DependencyFlowNodeData;
  const label = node.kind === 'folder' ? node.label : '';
  return (
    <div className="h-full w-full">
      <p className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function FileRow({ data }: NodeProps) {
  const node = data as DependencyFlowNodeData;
  if (node.kind !== 'file') {
    return null;
  }
  const name = node.path.split('/').pop() ?? node.path;
  return (
    <div className="flex h-full w-full items-center justify-between gap-2 px-1">
      <span className="truncate text-xs">{name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{node.language}</span>
    </div>
  );
}
