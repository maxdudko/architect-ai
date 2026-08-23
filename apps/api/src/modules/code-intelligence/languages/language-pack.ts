import { ParsedFileAst } from '../types/ast.type';
import { ExtractedSymbol } from '../types/code-symbol.type';
import { ProgrammingLanguage } from '../types/programming-language.type';
import { RepositoryFileCandidate } from '../types/repository-file-candidate.type';
import { ExtractedSymbolRelationship } from '../types/symbol-relationship.type';

export type TopologyTechMarkerCategory =
  | 'language'
  | 'framework'
  | 'tooling'
  | 'data'
  | 'runtime';

export interface TopologyTechMarker {
  pattern: RegExp;
  name: string;
  category: TopologyTechMarkerCategory;
}

export interface LanguagePackTopologyHints {
  entryFileStems: string[];
  entryBasenames: string[];
  entryPathPatterns: RegExp[];
  highConfidenceEntryStems: string[];
  highConfidenceEntryBasenames: string[];
  serviceSuffixes: string[];
  techMarkers: TopologyTechMarker[];
}

export interface LanguagePack {
  id: ProgrammingLanguage;
  languages: ProgrammingLanguage[];
  extensions: Record<string, ProgrammingLanguage>;
  ignoreFolders: string[];
  manifestBasenames: string[];
  manifestPathPatterns: RegExp[];
  topologyHints: LanguagePackTopologyHints;
  resolveGrammar(
    file: Pick<RepositoryFileCandidate, 'language' | 'extension'>,
  ): unknown;
  extractSymbols(filePath: string, ast: ParsedFileAst): ExtractedSymbol[];
  extractRelations(params: {
    filePath: string;
    ast: ParsedFileAst;
    symbols: ExtractedSymbol[];
  }): ExtractedSymbolRelationship[];
}
