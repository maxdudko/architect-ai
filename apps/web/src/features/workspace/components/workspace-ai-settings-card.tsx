'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  Loader,
  Skeleton,
} from '@/shared/components';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  useDeleteWorkspaceAiSettingsMutation,
  useTestWorkspaceAiKeyMutation,
  useUpsertWorkspaceAiSettingsMutation,
  useWorkspaceAiSettingsQuery,
} from '../services/workspace.service';

export function WorkspaceAiSettingsCard({ workspaceId }: { workspaceId: string }) {
  const settingsQuery = useWorkspaceAiSettingsQuery(workspaceId);
  const upsertMutation = useUpsertWorkspaceAiSettingsMutation(workspaceId);
  const deleteMutation = useDeleteWorkspaceAiSettingsMutation(workspaceId);
  const testMutation = useTestWorkspaceAiKeyMutation(workspaceId);
  const [apiKey, setApiKey] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const settings = settingsQuery.data;
  const isByok = settings?.mode === 'BYOK';
  const pastedKey = apiKey.trim();
  const canTestPasted = pastedKey.length >= 8;
  const isBusy =
    upsertMutation.isPending || deleteMutation.isPending || testMutation.isPending;

  const onConnect = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await upsertMutation.mutateAsync(apiKey.trim());
      setApiKey('');
      setSuccessMessage('OpenAI API key saved. This workspace now uses BYOK.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to save the OpenAI API key.'));
    }
  };

  const onRemove = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteMutation.mutateAsync();
      setSuccessMessage('API key removed. This workspace now uses Hosted AI.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to remove the OpenAI API key.'));
    }
  };

  const onTest = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await testMutation.mutateAsync(canTestPasted ? pastedKey : undefined);
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to test the OpenAI API key.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {settingsQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {settingsQuery.isError ? (
          <ErrorState
            title="Unable to load AI settings"
            description="Refresh the page to try again."
          />
        ) : null}
        {settings ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isByok ? 'default' : 'secondary'}>
                {isByok ? 'BYOK' : 'Hosted AI'}
              </Badge>
              {isByok && settings.openaiKeyLast4 ? (
                <span className="text-sm text-muted-foreground">
                  OpenAI key ending in {settings.openaiKeyLast4}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {isByok
                ? 'Chat and onboarding guides use your OpenAI key and are unlimited. Repository, indexing, and member limits still apply.'
                : 'This workspace uses Hosted AI with plan limits for questions and guides. Connect an OpenAI API key to switch to BYOK and uncap those two.'}
            </p>
            <div className="space-y-2">
              <label htmlFor="openai-api-key" className="text-sm font-medium">
                OpenAI API key
              </label>
              <Input
                id="openai-api-key"
                type="password"
                autoComplete="off"
                placeholder="sk-..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isBusy || pastedKey.length < 8}
                onClick={() => void onConnect()}
              >
                {upsertMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                {isByok ? 'Replace key' : 'Connect key'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isBusy || (!canTestPasted && !isByok)}
                onClick={() => void onTest()}
              >
                {testMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                Test key
              </Button>
              {isByok ? (
                <Button type="button" variant="outline" disabled={isBusy} onClick={() => void onRemove()}>
                  {deleteMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                  Use Hosted AI
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
      </CardContent>
    </Card>
  );
}
