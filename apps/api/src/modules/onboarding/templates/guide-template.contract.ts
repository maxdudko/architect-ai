import { GuideType } from '@prisma/client';

export interface GuideTemplateContract {
  type: GuideType;
  title: string;
  headings: string[];
  objective: string;
}

export const GUIDE_TEMPLATE_CONTRACTS: Record<
  GuideType,
  GuideTemplateContract
> = {
  EXECUTIVE_SUMMARY: {
    type: GuideType.EXECUTIVE_SUMMARY,
    title: 'Executive Summary',
    headings: [
      'Project Purpose and Business Domain',
      'Primary Responsibilities',
      'Architecture Style',
      'Scale and Complexity',
      'Technology Snapshot',
      'What to Understand First',
    ],
    objective:
      'Give a concise overview readable in under two minutes, including repository size, approximate complexity, architecture style, and main technologies.',
  },
  PROJECT_OVERVIEW: {
    type: GuideType.PROJECT_OVERVIEW,
    title: 'Project Overview',
    headings: [
      'Purpose',
      'Architecture Overview',
      'Application and Request Flow',
      'Data Flow',
      'Entry Points',
      'Main Domains',
      'External Integrations',
    ],
    objective:
      'Orient a new engineer to the repository architecture and primary flows.',
  },
  FOLDER: {
    type: GuideType.FOLDER,
    title: 'Folder Guide',
    headings: [
      'Repository Map',
      'Major Folder Responsibilities',
      'Important Modules and Entry Points',
      'Dependencies Between Folders',
      'Navigation Heuristics',
    ],
    objective:
      'Provide one consolidated conceptual map that explains the architectural intent of every major folder rather than listing its contents.',
  },
  MODULE: {
    type: GuideType.MODULE,
    title: 'Module Guide',
    headings: [
      'Purpose',
      'Responsibilities',
      'Main Services and Public APIs',
      'Dependencies and Related Modules',
      'Important Files',
      'Change Guidance',
    ],
    objective:
      'Explain one significant module as a cohesive responsibility boundary.',
  },
  SERVICE: {
    type: GuideType.SERVICE,
    title: 'Service Guide',
    headings: [
      'Purpose',
      'Responsibilities',
      'Collaborators and Dependencies',
      'Important Methods',
      'Design Patterns',
      'Change Guidance',
    ],
    objective:
      'Explain one service candidate, its boundaries, and collaborators.',
  },
  TECHNOLOGY_STACK: {
    type: GuideType.TECHNOLOGY_STACK,
    title: 'Technology Stack',
    headings: [
      'Languages, Runtimes, and Frameworks',
      'Databases and ORM',
      'Queues, Messaging, and Caching',
      'Authentication and Storage',
      'AI Infrastructure',
      'Why Each Technology Exists',
      'Evidence and Unknowns',
    ],
    objective:
      'Describe technologies only where indexed evidence supports them.',
  },
  READING_ORDER: {
    type: GuideType.READING_ORDER,
    title: 'Suggested Reading Order',
    headings: ['Recommended Path', 'Why This Order', 'Role-Based Shortcuts'],
    objective:
      'Create a progressive reading path that teaches concepts before details.',
  },
  GLOSSARY: {
    type: GuideType.GLOSSARY,
    title: 'Project Glossary',
    headings: [
      'Domain Terms',
      'Architecture Terms',
      'Acronyms and Ambiguities',
    ],
    objective:
      'Define repository-specific terms without inventing unsupported meanings.',
  },
  COMMON_PITFALLS: {
    type: GuideType.COMMON_PITFALLS,
    title: 'Common Pitfalls',
    headings: [
      'High-Risk Changes',
      'Common Misunderstandings',
      'Safe Change Checklist',
    ],
    objective:
      'Highlight evidence-backed change hazards and clearly label inference.',
  },
};
