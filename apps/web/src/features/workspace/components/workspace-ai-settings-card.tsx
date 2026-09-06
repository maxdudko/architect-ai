'use client';

import { Check, KeyRound } from 'lucide-react';
import { useState } from 'react';
import type { AiProvider } from '@/entities';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Loader,
  PasswordInput,
  Skeleton,
} from '@/shared/components';
import {
  useDeleteWorkspaceAiCredentialMutation,
  useSetActiveAiProviderMutation,
  useTestWorkspaceAiCredentialMutation,
  useUpsertWorkspaceAiCredentialMutation,
  useWorkspaceAiSettingsQuery,
} from '../services/workspace.service';

const PROVIDERS: Array<{ id: AiProvider; label: string; placeholder: string }> = [
  { id: 'OPENAI', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'ANTHROPIC', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'GROK', label: 'Grok (xAI)', placeholder: 'xai-...' },
  { id: 'GEMINI', label: 'Gemini (Google)', placeholder: 'AIza...' },
];

export function WorkspaceAiSettingsCard({ workspaceId }: { workspaceId: string }) {
  const settingsQuery = useWorkspaceAiSettingsQuery(workspaceId);
  const upsertMutation = useUpsertWorkspaceAiCredentialMutation(workspaceId);
  const deleteMutation = useDeleteWorkspaceAiCredentialMutation(workspaceId);
  const activateMutation = useSetActiveAiProviderMutation(workspaceId);
  const testMutation = useTestWorkspaceAiCredentialMutation(workspaceId);

  const [openProvider, setOpenProvider] = useState<AiProvider | null>(null);
  const [apiKeyByProvider, setApiKeyByProvider] = useState<Partial<Record<AiProvider, string>>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    open: boolean;
    tone: 'error' | 'success';
    title: string;
    message: string;
  } | null>(null);

  const settings = settingsQuery.data;
  const activeProvider = settings?.activeProvider ?? null;
  const credentialByProvider = new Map(
    (settings?.credentials ?? []).map((credential) => [credential.provider, credential]),
  );
  const isBusy =
    upsertMutation.isPending ||
    deleteMutation.isPending ||
    activateMutation.isPending ||
    testMutation.isPending;

  const setApiKey = (provider: AiProvider, value: string) => {
    setApiKeyByProvider((current) => ({ ...current, [provider]: value }));
  };

  const onSave = async (provider: AiProvider, label: string) => {
    const apiKey = (apiKeyByProvider[provider] ?? '').trim();
    setMessage(null);
    try {
      await upsertMutation.mutateAsync({ provider, apiKey });
      setApiKey(provider, '');
      setOpenProvider(null);
      setMessage({ tone: 'success', text: `${label} key saved and set as your active provider.` });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, `Unable to save the ${label} API key.`),
      });
    }
  };

  const onTest = async (provider: AiProvider, label: string) => {
    const pasted = (apiKeyByProvider[provider] ?? '').trim();
    try {
      const result = await testMutation.mutateAsync({
        provider,
        apiKey: pasted.length >= 8 ? pasted : undefined,
      });
      setTestResult({
        open: true,
        tone: 'success',
        title: `${label} API key test passed`,
        message: result.message,
      });
    } catch (error) {
      setTestResult({
        open: true,
        tone: 'error',
        title: `${label} API key test failed`,
        message: getApiErrorMessage(error, `Unable to test the ${label} API key.`),
      });
    }
  };

  const onActivate = async (provider: AiProvider, label: string) => {
    setMessage(null);
    try {
      await activateMutation.mutateAsync(provider);
      setMessage({ tone: 'success', text: `Switched to ${label}.` });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, `Unable to switch to ${label}.`),
      });
    }
  };

  const onRemove = async (provider: AiProvider, label: string) => {
    setMessage(null);
    try {
      await deleteMutation.mutateAsync(provider);
      setMessage({ tone: 'success', text: `${label} key removed.` });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, `Unable to remove the ${label} key.`),
      });
    }
  };

  const onUseHosted = async () => {
    setMessage(null);
    try {
      await activateMutation.mutateAsync(null);
      setMessage({ tone: 'success', text: 'Switched to Hosted AI.' });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, 'Unable to switch to Hosted AI.'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI provider</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Use the model you trust — Architect AI is model-agnostic. Bring your own key for any
          provider below, use Hosted AI, or switch whenever you want. Nothing is locked in.
        </p>

        {settingsQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {settingsQuery.isError ? (
          <ErrorState
            title="Unable to load AI settings"
            description="Refresh the page to try again."
          />
        ) : null}

        {settings ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Badge variant={activeProvider === null ? 'default' : 'secondary'}>Hosted AI</Badge>
                <span className="text-sm text-muted-foreground">
                  Uses Architect AI&apos;s built-in provider with plan limits.
                </span>
              </div>
              {activeProvider !== null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => void onUseHosted()}
                >
                  {activateMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                  Use Hosted AI
                </Button>
              ) : (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> Active
                </span>
              )}
            </div>

            {PROVIDERS.map(({ id, label, placeholder }) => {
              const credential = credentialByProvider.get(id);
              const isActive = activeProvider === id;
              const isOpen = openProvider === id;
              const pastedKey = (apiKeyByProvider[id] ?? '').trim();
              const canTestKey = pastedKey.length >= 8 || Boolean(credential);
              return (
                <div key={id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={isActive ? 'default' : 'secondary'}>{label}</Badge>
                      {credential ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <KeyRound className="h-3.5 w-3.5" /> Key ending in {credential.keyLast4}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No key saved</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                          <Check className="h-4 w-4" /> Active
                        </span>
                      ) : credential ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void onActivate(id, label)}
                        >
                          {activateMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                          Use {label}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => setOpenProvider(isOpen ? null : id)}
                      >
                        {credential ? 'Replace key' : 'Add key'}
                      </Button>
                      {credential ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void onTest(id, label)}
                          >
                            {testMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                            Test key
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void onRemove(id, label)}
                          >
                            {deleteMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <PasswordInput
                        aria-label={`${label} API key`}
                        placeholder={placeholder}
                        autoComplete="off"
                        className="max-w-xs"
                        value={apiKeyByProvider[id] ?? ''}
                        onChange={(event) => setApiKey(id, event.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy || (apiKeyByProvider[id] ?? '').trim().length < 8}
                        onClick={() => void onSave(id, label)}
                      >
                        {upsertMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                        Save & activate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy || !canTestKey}
                        onClick={() => void onTest(id, label)}
                      >
                        {testMutation.isPending ? <Loader className="mr-2 h-4 w-4" /> : null}
                        Test key
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {message ? (
          <p
            className={
              message.tone === 'error' ? 'text-sm text-destructive' : 'text-sm text-emerald-600'
            }
          >
            {message.text}
          </p>
        ) : null}
      </CardContent>

      <Dialog
        open={testResult?.open ?? false}
        onOpenChange={(open) => {
          if (!open) {
            setTestResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle
              className={testResult?.tone === 'error' ? 'text-destructive' : 'text-emerald-600'}
            >
              {testResult?.title}
            </DialogTitle>
            <DialogDescription className="pt-1 text-foreground">
              {testResult?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setTestResult(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
