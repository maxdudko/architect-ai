'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { InvitationPreview } from '@/entities';
import { getInvitationPreview } from '@/lib/api';
import {
  acceptInvitationSchema,
  type AcceptInvitationFormValues,
} from '../schemas/accept-invitation.schema';
import { useInvitationAuth } from '../services/invitation-auth.service';

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; preview: InvitationPreview };

function getPreviewErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.status === 404) {
      return 'This invitation was not found or has already been used.';
    }
    if (error.response?.status === 410) {
      return 'This invitation has expired.';
    }
  }
  return 'Unable to load this invitation. Please try again.';
}

function getAcceptErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }
  }
  return 'Unable to accept this invitation. Please try again.';
}

export function useAcceptInvitation(token: string) {
  const { acceptInvitation, logout, user, isAuthenticated } = useInvitationAuth();
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'loading' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const form = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      password: '',
    },
  });

  const loadPreview = useCallback(async () => {
    setPreviewState({ status: 'loading' });
    try {
      const preview = await getInvitationPreview(token);
      setPreviewState({ status: 'ready', preview });
    } catch (error) {
      setPreviewState({ status: 'error', message: getPreviewErrorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleAccept = useCallback(
    async (payload: AcceptInvitationFormValues | Record<string, never> = {}) => {
      setErrorMessage(null);
      setIsAccepting(true);
      try {
        await acceptInvitation(token, payload);
      } catch (error) {
        setErrorMessage(getAcceptErrorMessage(error));
      } finally {
        setIsAccepting(false);
      }
    },
    [acceptInvitation, token],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    await handleAccept(values);
  });

  const emailMismatch =
    previewState.status === 'ready' &&
    isAuthenticated &&
    user &&
    user.email.toLowerCase() !== previewState.preview.email.toLowerCase();

  return {
    previewState,
    form,
    onSubmit,
    handleAccept,
    errorMessage,
    isAccepting,
    emailMismatch,
    logout,
    user,
    isAuthenticated,
  };
}
