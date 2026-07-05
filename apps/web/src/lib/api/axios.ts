import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { loadAuthState } from '@/lib/auth/storage';

type RefreshHandler = () => Promise<string | null>;

let refreshHandler: RefreshHandler | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

function withAuthHeader(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = loadAuthState()?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

apiClient.interceptors.request.use(withAuthHeader);

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/signin', '/auth/signup', '/auth/refresh'];

function shouldAttemptTokenRefresh(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? '';
  return !AUTH_ENDPOINTS_WITHOUT_REFRESH.some((endpoint) => url.includes(endpoint));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const isUnauthorized = error.response?.status === 401;

    if (
      !isUnauthorized ||
      !originalRequest ||
      !refreshHandler ||
      !shouldAttemptTokenRefresh(originalRequest)
    ) {
      return Promise.reject(error);
    }

    if ((originalRequest as InternalAxiosRequestConfig & { _retry?: boolean })._retry) {
      return Promise.reject(error);
    }

    (originalRequest as InternalAxiosRequestConfig & { _retry?: boolean })._retry = true;

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshHandler().finally(() => {
        isRefreshing = false;
      });
    }

    const newToken = await refreshPromise;
    if (!newToken) {
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(originalRequest);
  },
);

export function registerApiRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}
