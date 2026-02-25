import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { TokenManager } from './TokenManager';

/**
 * Custom Axios instance with auth interceptors
 * Handles JWT token injection and automatic refresh
 */

class ApiClientClass {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;

  constructor() {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
    
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true, // Send cookies with requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - Add auth header
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = TokenManager.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => Promise.reject(error)
    );

    // Response interceptor - Handle 401 and token refresh
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh token
            const newToken = await this.refreshToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.handleAuthError();
            return Promise.reject(refreshError);
          }
        }

        // Redirect to login on 401 if token refresh failed
        if (error.response?.status === 401) {
          this.handleAuthError();
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = (async () => {
      try {
        const refreshToken = TokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // POST without adding auth header to avoid loop
        const response = await this.client.post('/api/auth/token/refresh', {});

        const newToken = response.data.data.token;
        TokenManager.setTokens(newToken, refreshToken);
        return newToken;
      } catch (error) {
        TokenManager.clearTokens();
        throw error;
      } finally {
        this.refreshTokenPromise = null;
      }
    })();

    return this.refreshTokenPromise;
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(): void {
    TokenManager.clearTokens();
    window.location.href = '/login';
  }

  /**
   * Get the axios instance for manual API calls
   */
  getInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * Make GET request
   */
  get<T = any>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  /**
   * Make POST request
   */
  post<T = any>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  /**
   * Make PUT request
   */
  put<T = any>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  /**
   * Make PATCH request
   */
  patch<T = any>(url: string, data?: any, config?: any) {
    return this.client.patch<T>(url, data, config);
  }

  /**
   * Make DELETE request
   */
  delete<T = any>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const ApiClient = new ApiClientClass();
