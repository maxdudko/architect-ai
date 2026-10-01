import Link from 'next/link';
import { Button } from '@/shared/components';

interface ArchitectureSectionNavProps {
  repositoryId: string;
  section: 'map' | 'search' | 'overview';
}

export function ArchitectureSectionNav({ repositoryId, section }: ArchitectureSectionNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant={section === 'map' ? 'default' : 'outline'}>
        <Link href={`/repositories/${repositoryId}/architecture`}>Dependency map</Link>
      </Button>
      <Button asChild size="sm" variant={section === 'search' ? 'default' : 'outline'}>
        <Link href={`/repositories/${repositoryId}/architecture/search`}>Search</Link>
      </Button>
      <Button asChild size="sm" variant={section === 'overview' ? 'default' : 'outline'}>
        <Link href={`/repositories/${repositoryId}/architecture/overview`}>Overview</Link>
      </Button>
    </div>
  );
}
