import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forbidden</CardTitle>
          <CardDescription>Your role does not have access to this resource.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
