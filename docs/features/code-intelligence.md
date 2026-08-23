# Code Intelligence Architecture

## Goals

The Code Intelligence layer builds a semantic representation of source code repositories. It is intentionally decoupled from embedding providers and LLM runtimes.

## Module Layout

`apps/api/src/modules/code-intelligence/`

- `scanner/` — repository traversal and candidate file streaming
- `languages/` — language detection and language packs (grammars, extractors, topology hints)
- `parser/` — language parser abstraction and Tree-sitter adapter
- `ast/` — AST abstraction independent from Tree-sitter internals
- `extractors/` — symbol extraction and semantic chunking
- `relationships/` — static relationship extraction between symbols
- `inventory/` — repository file inventory persistence
- `storage/` — persistence adapter over repository repository
- `interfaces/` — reusable contracts
- `types/` — shared DTO-style types
- `utils/` — checksum, line/token metrics, generated-file detection

## Pipeline

1. `RepositoryScannerService` recursively scans the clone path, skipping pack ignore folders and inventorying manifests without parsing.
2. `LanguageDetectorService` resolves language for each file from registered language packs.
3. `TreeSitterLanguageParserService` parses source with the pack grammar and returns field-aware `ParsedFileAst`.
4. `SymbolExtractorService` dispatches to the matching pack to extract symbols.
5. `SymbolRelationshipExtractorService` dispatches to the matching pack to extract static relationships.
6. `RepositoryInventoryService` upserts repository file inventory by `repositoryId + path`.
7. `ChunkBuilderService` creates one semantic chunk per meaningful symbol.

## Worker Orchestration

Business logic stays in the Code Intelligence module.

- `RepositoryParseService` delegates to `CodeIntelligenceParseService`.
- `RepositoryChunkService` delegates to `ChunkBuilderService`.
- BullMQ worker orchestrates stage transitions only.

## Schema Decisions

- `RepositoryFile` is unique per `(repositoryId, path)` to prevent duplication across runs.
- After each successful parse pass, inventory rows whose `indexingRunId` is not the current run are pruned so the file index reflects only files seen in the latest scan.
- `CodeSymbol` stores coordinates, modifiers, qualified naming, and parent linkage.
- `SymbolRelation` stores graph edges for traversal (`from`, `to`, relation type).
- `Chunk.metadata` stores semantic context (`symbolType`, `qualifiedName`, `language`).
- `IndexingRun.processingDurationMs` and `errors` support run-level observability.

## Extension Points

- Add a new language by creating `languages/<id>.pack.ts` (extensions, grammar, ignore folders, manifests, topology hints, symbol/relation extractors), registering it in `loadDefaultLanguagePacks()`, and adding a Tree-sitter grammar dependency.
- Preserve Tree-sitter field names on `AstNode` so extractors can read `name` / `body` without regexes on `node.text`.
- Add new relationship types by extending `SymbolRelationType` and extractor logic.
- Add embedding generation as a downstream stage via the Retrieval module (`docs/retrieval.md`), independent from chunk generation.
