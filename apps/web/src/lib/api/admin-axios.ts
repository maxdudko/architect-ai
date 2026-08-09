import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { loadAdminAuthState } from '@/lib/auth/admin-storage';

type RefreshHandler = () => Promise<string | null>;

let refreshHandler: RefreshHandler | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:5000';

export const adminApiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10000,
});

function withAdminAuthHeader(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = loadAdminAuthState()?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers['x-request-id']) {
    config.headers['x-request-id'] = createRequestId();
  }
  return config;
}

adminApiClient.interceptors.request.use(withAdminAuthHeader);

const ADMIN_AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  '/admin/auth/signin',
  '/admin/auth/refresh',
];

function shouldAttemptTokenRefresh(config: InternalAxiosRequestConfig): boolean {
  const url = config.url ?? '';
  return !ADMIN_AUTH_ENDPOINTS_WITHOUT_REFRESH.some((endpoint) => url.includes(endpoint));
}

adminApiClient.interceptors.response.use(
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
    return adminApiClient(originalRequest);
  },
);

export function registerAdminApiRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
