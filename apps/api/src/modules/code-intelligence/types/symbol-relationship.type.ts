import { SymbolRelationType } from '@prisma/client';

export interface ExtractedSymbolRelationship {
  relationType: SymbolRelationType;
  fromSymbolLocalId: string;
  toSymbolQualifiedName: string;
  toSymbolLocalId?: string;
  targetFilePath?: string;
}
