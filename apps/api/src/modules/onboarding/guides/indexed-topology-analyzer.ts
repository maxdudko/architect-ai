import { Inject, Injectable } from '@nestjs/common';
import type { IndexedTopologyDataSource } from '../interfaces/indexed-topology-data-source.interface';
import { INDEXED_TOPOLOGY_DATA_SOURCE } from '../interfaces/tokens';
import type {
  IndexedTopologySnapshot,
  RepositoryTopology,
  TopologyCandidate,
  TopologyTechnologyEvidence,
} from '../types/topology.type';

@Injectable()
export class IndexedTopologyAnalyzer {
  constructor(
    @Inject(INDEXED_TOPOLOGY_DATA_SOURCE)
    private readonly dataSource: IndexedTopologyDataSource,
  ) {}

  async analyze(
    workspaceId: string,
    repositoryId: string,
  ): Promise<RepositoryTopology> {
    const snapshot = await this.dataSource.loadLatest(
      workspaceId,
      repositoryId,
    );
    const folders = this.aggregateFolders(snapshot);
    const sourceLines = snapshot.files.reduce(
      (total, file) => total + file.lineCount,
      0,
    );
    const relationCount = snapshot.relations.length;
    const symbols = snapshot.symbols.length;

    return {
      repository: snapshot.repository,
      counts: {
        files: snapshot.files.length,
        sourceLines,
        symbols,
        relations: relationCount,
        exportedSymbols: snapshot.symbols.filter((symbol) => symbol.exported)
          .length,
        asyncSymbols: snapshot.symbols.filter((symbol) => symbol.isAsync)
          .length,
        averageSymbolsPerFile: this.round(
          symbols / Math.max(snapshot.files.length, 1),
        ),
        relationDensity: this.round(relationCount / Math.max(symbols, 1)),
      },
      complexity: this.complexity(snapshot.files.length, sourceLines, symbols),
      majorFolders: folders.slice(0, 15),
      moduleCandidates: this.moduleCandidates(snapshot, folders),
      serviceCandidates: this.serviceCandidates(snapshot),
      entryPointHints: this.entryPoints(snapshot),
      technologyEvidence: this.technologyEvidence(snapshot),
      source: snapshot.run,
    };
  }

  private aggregateFolders(snapshot: IndexedTopologySnapshot) {
    const values = new Map<
      string,
      { fileCount: number; lineCount: number; symbolCount: number }
    >();
    for (const file of snapshot.files) {
      const parts = file.path.split('/');
      const path =
        parts.length > 1
          ? parts.slice(0, Math.min(2, parts.length - 1)).join('/')
          : '.';
      const current = values.get(path) ?? {
        fileCount: 0,
        lineCount: 0,
        symbolCount: 0,
      };
      current.fileCount += 1;
      current.lineCount += file.lineCount;
      values.set(path, current);
    }
    for (const symbol of snapshot.symbols) {
      const folder = this.folderFor(symbol.filePath);
      const current = values.get(folder);
      if (current) current.symbolCount += 1;
    }
    return [...values.entries()]
      .map(([path, value]) => {
        const relationCount = snapshot.relations.filter(
          (relation) =>
            relation.fromFilePath.startsWith(`${path}/`) ||
            relation.targetFilePath?.startsWith(`${path}/`),
        ).length;
        return {
          path,
          ...value,
          relationCount,
          score: this.round(
            value.fileCount * 2 +
              value.symbolCount +
              Math.min(relationCount, 30) +
              Math.log10(value.lineCount + 1) * 3,
          ),
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score || left.path.localeCompare(right.path),
      );
  }

  private moduleCandidates(
    snapshot: IndexedTopologySnapshot,
    folders: RepositoryTopology['majorFolders'],
  ): TopologyCandidate[] {
    return folders
      .filter(
        (folder) =>
          folder.fileCount >= 2 &&
          !/(test|spec|fixture|vendor|generated|dist|build|node_modules)/i.test(
            folder.path,
          ),
      )
      .slice(0, 20)
      .map((folder) => {
        const explicitModule = snapshot.symbols.some(
          (symbol) =>
            symbol.filePath.startsWith(`${folder.path}/`) &&
            (symbol.type === 'MODULE' || /Module$/.test(symbol.name)),
        );
        return {
          key: folder.path,
          name: this.humanize(folder.path.split('/').at(-1) ?? folder.path),
          path: folder.path,
          evidencePaths: snapshot.files
            .filter((file) => file.path.startsWith(`${folder.path}/`))
            .slice(0, 8)
            .map((file) => file.path),
          score: folder.score + (explicitModule ? 15 : 0),
          reasons: [
            `${folder.fileCount} indexed files and ${folder.symbolCount} symbols`,
            explicitModule
              ? 'Contains an explicit module symbol'
              : 'Forms a cohesive indexed folder boundary',
          ],
        };
      })
      .sort((left, right) => right.score - left.score);
  }

  private serviceCandidates(
    snapshot: IndexedTopologySnapshot,
  ): TopologyCandidate[] {
    const candidates = new Map<string, TopologyCandidate>();
    for (const symbol of snapshot.symbols) {
      if (
        !/(Service|Controller|Repository|Provider|Client|Worker|Processor|Handler|Gateway)$/i.test(
          symbol.name,
        )
      ) {
        continue;
      }
      const relationCount = snapshot.relations.filter(
        (relation) =>
          relation.fromFilePath === symbol.filePath ||
          relation.targetFilePath === symbol.filePath,
      ).length;
      candidates.set(symbol.qualifiedName, {
        key: symbol.qualifiedName,
        name: symbol.name,
        path: symbol.filePath,
        evidencePaths: [symbol.filePath],
        score: 10 + (symbol.exported ? 5 : 0) + Math.min(relationCount, 20),
        reasons: [
          `${symbol.type.toLowerCase()} name indicates a service boundary`,
          `${relationCount} indexed incoming/outgoing relations`,
        ],
      });
    }
    return [...candidates.values()]
      .sort(
        (left, right) =>
          right.score - left.score || left.key.localeCompare(right.key),
      )
      .slice(0, 30);
  }

  private entryPoints(snapshot: IndexedTopologySnapshot) {
    const pattern =
      /(^|\/)(main|index|server|app|bootstrap|worker|cli|application)\.[^.]+$/i;
    return snapshot.files
      .filter((file) => pattern.test(file.path))
      .map((file) => {
        const basename = file.path.split('/').at(-1) ?? file.path;
        return {
          path: file.path,
          confidence: /^(main|server|bootstrap)\./i.test(basename)
            ? ('high' as const)
            : ('medium' as const),
          evidence: `Indexed filename "${basename}" is a conventional entry point`,
        };
      })
      .slice(0, 20);
  }

  private technologyEvidence(
    snapshot: IndexedTopologySnapshot,
  ): TopologyTechnologyEvidence[] {
    const evidence: TopologyTechnologyEvidence[] = [];
    const byLanguage = new Map<string, string[]>();
    for (const file of snapshot.files) {
      const paths = byLanguage.get(file.language) ?? [];
      paths.push(file.path);
      byLanguage.set(file.language, paths);
    }
    for (const [language, paths] of byLanguage) {
      evidence.push({
        name: language,
        category: 'language',
        confidence: paths.length >= 3 ? 'high' : 'medium',
        evidencePaths: paths.slice(0, 5),
        evidence: `${paths.length} indexed non-generated files report this language`,
      });
    }

    const markers: Array<
      [RegExp, string, TopologyTechnologyEvidence['category']]
    > = [
      [/(^|\/)package\.json$/, 'Node.js package ecosystem', 'runtime'],
      [
        /(^|\/)(pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/,
        'JavaScript package manager',
        'tooling',
      ],
      [/(^|\/)nest-cli\.json$/, 'NestJS', 'framework'],
      [/(^|\/)next\.config\./, 'Next.js', 'framework'],
      [/(^|\/)prisma\/schema\.prisma$/, 'Prisma', 'data'],
      [/(^|\/)dockerfile$/i, 'Docker', 'tooling'],
      [
        /(^|\/)(pyproject\.toml|requirements\.txt)$/,
        'Python package ecosystem',
        'runtime',
      ],
      [/(^|\/)(go\.mod)$/, 'Go modules', 'runtime'],
      [/(^|\/)(cargo\.toml)$/, 'Rust Cargo', 'runtime'],
    ];
    for (const [pattern, name, category] of markers) {
      const paths = snapshot.files
        .filter((file) => pattern.test(file.path))
        .map((file) => file.path);
      if (paths.length) {
        evidence.push({
          name,
          category,
          confidence: 'high',
          evidencePaths: paths,
          evidence: 'Detected from indexed manifest or configuration path',
        });
      }
    }
    return evidence.sort((left, right) => left.name.localeCompare(right.name));
  }

  private complexity(files: number, lines: number, symbols: number) {
    const score = files + lines / 200 + symbols / 5;
    if (score < 100) return 'small' as const;
    if (score < 400) return 'moderate' as const;
    if (score < 1200) return 'large' as const;
    return 'very-large' as const;
  }

  private folderFor(path: string): string {
    const parts = path.split('/');
    return parts.length > 1
      ? parts.slice(0, Math.min(2, parts.length - 1)).join('/')
      : '.';
  }

  private humanize(value: string): string {
    return value
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
