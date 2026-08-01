import type { GuideType, OnboardingGuide } from '@/entities';

export const GUIDE_TYPE_LABELS: Record<GuideType, string> = {
  EXECUTIVE_SUMMARY: 'Executive summary',
  PROJECT_OVERVIEW: 'Project overview',
  TECHNOLOGY_STACK: 'Technology stack',
  FOLDER: 'Folders',
  MODULE: 'Modules',
  SERVICE: 'Services',
  READING_ORDER: 'Reading order',
  GLOSSARY: 'Glossary',
  COMMON_PITFALLS: 'Common pitfalls',
};

const GROUPS: Array<{ label: string; types: GuideType[] }> = [
  {
    label: 'Overview',
    types: ['EXECUTIVE_SUMMARY', 'PROJECT_OVERVIEW', 'TECHNOLOGY_STACK'],
  },
  { label: 'Folders', types: ['FOLDER'] },
  { label: 'Modules', types: ['MODULE'] },
  { label: 'Services', types: ['SERVICE'] },
  { label: 'Knowledge', types: ['READING_ORDER', 'GLOSSARY', 'COMMON_PITFALLS'] },
];

export interface GuideTreeGroup {
  label: string;
  guides: OnboardingGuide[];
}

export function groupGuides(guides: OnboardingGuide[]): GuideTreeGroup[] {
  return GROUPS.map((group) => ({
    label: group.label,
    guides: guides
      .filter((guide) => group.types.includes(guide.type))
      .sort(
        (a, b) =>
          group.types.indexOf(a.type) - group.types.indexOf(b.type) ||
          a.title.localeCompare(b.title),
      ),
  })).filter((group) => group.guides.length > 0);
}

export function getDefaultGuide(guides: OnboardingGuide[]): OnboardingGuide | undefined {
  return groupGuides(guides).flatMap((group) => group.guides)[0];
}
