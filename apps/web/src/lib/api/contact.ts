import { apiClient } from './axios';

export interface ContactMessagePayload {
  name: string;
  email: string;
  message: string;
}

export async function submitContactMessage(
  payload: ContactMessagePayload,
): Promise<{ success: true }> {
  const { data } = await apiClient.post<{ success: true }>('/contact', payload);
  return data;
}
