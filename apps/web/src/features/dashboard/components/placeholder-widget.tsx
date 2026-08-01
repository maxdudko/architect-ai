import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components';

interface PlaceholderWidgetProps {
  title: string;
  description: string;
}

export function PlaceholderWidget({ title, description }: PlaceholderWidgetProps) {
  return (
    <Card className="opacity-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">Soon</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Coming in a later phase.</p>
      </CardContent>
    </Card>
  );
}
