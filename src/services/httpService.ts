/**
 * HTTP Service for API calls with Bearer Token authentication
 * Handles all HTTP requests with automatic token management
 */

import { DEMO_MODE, mockRequest } from "../mock";

// API Base URL - Update this with your backend API URL
// Reads from .env file in project root: VITE_API_BASE_URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://116.68.207.105:8080/api";

// API Request Logging disabled (console logs are never emitted)
const _API_LOG_REQUESTS = false;
void _API_LOG_REQUESTS;

export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface ApiError {
  message: string;
  status: number;
  data?: any;
}

/**
 * Get authentication token from localStorage
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem("auth_token");
};

/**
 * Get refresh token from localStorage (for token refresh flow)
 */
const getRefreshToken = (): string | null => {
  return localStorage.getItem("auth_refresh_token");
};

/**
 * Store new tokens after refresh (localStorage + sessionStorage so both stay in sync)
 */
export const setAuthTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem("auth_token", accessToken);
  localStorage.setItem("auth_refresh_token", refreshToken);
  sessionStorage.setItem("auth_token", accessToken);
  sessionStorage.setItem("auth_refresh_token", refreshToken);
};

/** Single in-flight refresh promise to dedupe concurrent 401s */
let refreshPromise: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

/**
 * Call POST /auth/refresh with current refresh token. On success updates stored tokens and returns them.
 * Uses raw fetch to avoid circular dependency and 401 handling. Dedupes concurrent calls.
 */
const tryRefresh = async (): Promise<{ accessToken: string; refreshToken: string } | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken?.trim()) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const url = buildUrl("/auth/refresh");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (data.accessToken && data.refreshToken) {
        setAuthTokens(data.accessToken, data.refreshToken);
        return { accessToken: data.accessToken, refreshToken: data.refreshToken };
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

/**
 * Handle logout when the access token is invalid or missing (401).
 * Note: This only clears auth data. The redirect is handled by ProtectedRoute
 * to avoid full page refresh.
 */
const handleUnauthorized = () => {
  // Clear auth data
  localStorage.removeItem("auth_user");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_refresh_token");
  localStorage.removeItem("auth_provider_type");
  localStorage.removeItem("auth_provider_category");
  localStorage.removeItem("auth_employment_type");
  sessionStorage.removeItem("auth_user");
  sessionStorage.removeItem("auth_refresh_token");
  sessionStorage.removeItem("auth_provider_type");
  sessionStorage.removeItem("auth_provider_category");
  sessionStorage.removeItem("auth_employment_type");
  
  // Dispatch custom event for components to listen to
  // This allows React Router navigation without page refresh
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
};

/**
 * Build query string from params object
 */
const buildQueryString = (params: Record<string, string | number | boolean>): string => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  return queryParams.toString();
};

/**
 * Build full URL with query parameters
 */
const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean>): string => {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  if (params && Object.keys(params).length > 0) {
    const queryString = buildQueryString(params);
    return `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
  }
  
  return url;
};

/**
 * Build request headers (optional token override for retry after refresh)
 */
const buildHeaders = (
  config?: RequestConfig,
  includeAuth: boolean = true,
  tokenOverride?: string | null
): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...config?.headers,
  };

  if (includeAuth) {
    const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
};

/**
 * Execute one fetch; if 401 and we have refresh token, try refresh and retry once with new token.
 * Returns the final Response (caller should pass to handleResponse).
 */
const fetchWithAuthRetry = async (
  method: string,
  url: string,
  body: string | undefined,
  signal: AbortSignal | undefined,
  config?: RequestConfig
): Promise<Response> => {
  let headers = buildHeaders(config);
  let response = await fetch(url, { method, headers, body, signal });
  if (response.status === 401 && getRefreshToken()) {
    const tokens = await tryRefresh();
    if (tokens) {
      headers = buildHeaders(undefined, true, tokens.accessToken);
      response = await fetch(url, { method, headers, body, signal });
    }
  }
  return response;
};

/** No-op: console logging is disabled */
const logRequest = (_method: string, _url: string, _body?: any, _headers?: HeadersInit) => {};

/** No-op: console logging is disabled */
const logResponse = <T>(_method: string, _url: string, _response: ApiResponse<T>, _error?: ApiError) => {};

/**
 * Handle API response
 */
const handleResponse = async <T>(response: Response, method?: string, url?: string): Promise<ApiResponse<T>> => {
  // Only 401 means the session/token is invalid — clear auth and redirect to login.
  // 403 is "authenticated but not allowed for this action" (e.g. supervisor cannot reject another supervisor's nurse slot); do not logout.
  if (response.status === 401) {
    const error = {
      message: "Unauthorized. Please login again.",
      status: response.status,
    } as ApiError;

    if (method && url) {
      logResponse(method, url, {} as ApiResponse<T>, error);
    }

    handleUnauthorized();
    throw error;
  }

  // Handle other errors
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const error = {
      message: errorData.message || errorData.error || "An error occurred",
      status: response.status,
      data: errorData,
    } as ApiError;

    if (method && url) {
      logResponse(method, url, {} as ApiResponse<T>, error);
    }

    throw error;
  }

  // Parse response data (204 No Content and 304 Not Modified have no body)
  let data: T;
  const status = response.status;
  const hasNoBody = status === 204 || status === 304;

  if (hasNoBody) {
    data = null as unknown as T; // 204/304: no body to parse
  } else {
    const contentType = response.headers.get("content-type");
    const text = await response.text();
    if (contentType && contentType.includes("application/json") && text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    } else {
      data = text as unknown as T;
    }
  }

  const apiResponse = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };

  // Log successful response
  if (method && url) {
    logResponse(method, url, apiResponse);
  }

  return apiResponse;
};

/**
 * HTTP Service Class
 */
class HttpService {
  /**
   * GET request
   */
  async get<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>("GET", endpoint, { params: config?.params });
    const url = buildUrl(endpoint, config?.params);
    logRequest("GET", url, undefined, buildHeaders(config));
    const response = await fetchWithAuthRetry("GET", url, undefined, config?.signal, config);
    try {
      return await handleResponse<T>(response, "GET", url);
    } catch (error: any) {
      logResponse("GET", url, {} as ApiResponse<T>, error);
      throw error;
    }
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>("POST", endpoint, { params: config?.params, body: data });
    const url = buildUrl(endpoint, config?.params);
    const body = data ? JSON.stringify(data) : undefined;
    logRequest("POST", url, data, buildHeaders(config));
    const response = await fetchWithAuthRetry("POST", url, body, config?.signal, config);
    try {
      return await handleResponse<T>(response, "POST", url);
    } catch (error: any) {
      logResponse("POST", url, {} as ApiResponse<T>, error);
      throw error;
    }
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>("PUT", endpoint, { params: config?.params, body: data });
    const url = buildUrl(endpoint, config?.params);
    const body = data ? JSON.stringify(data) : undefined;
    logRequest("PUT", url, data, buildHeaders(config));
    const response = await fetchWithAuthRetry("PUT", url, body, config?.signal, config);
    try {
      return await handleResponse<T>(response, "PUT", url);
    } catch (error: any) {
      logResponse("PUT", url, {} as ApiResponse<T>, error);
      throw error;
    }
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>("PATCH", endpoint, { params: config?.params, body: data });
    const url = buildUrl(endpoint, config?.params);
    const body = data ? JSON.stringify(data) : undefined;
    logRequest("PATCH", url, data, buildHeaders(config));
    const response = await fetchWithAuthRetry("PATCH", url, body, config?.signal, config);
    try {
      return await handleResponse<T>(response, "PATCH", url);
    } catch (error: any) {
      logResponse("PATCH", url, {} as ApiResponse<T>, error);
      throw error;
    }
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>("DELETE", endpoint, { params: config?.params });
    const url = buildUrl(endpoint, config?.params);
    logRequest("DELETE", url, undefined, buildHeaders(config));
    const response = await fetchWithAuthRetry("DELETE", url, undefined, config?.signal, config);
    try {
      return await handleResponse<T>(response, "DELETE", url);
    } catch (error: any) {
      logResponse("DELETE", url, {} as ApiResponse<T>, error);
      throw error;
    }
  }

  /**
   * GET request that returns the response as Blob (for document view/download).
   * Does not parse JSON; returns blob and headers (e.g. for Content-Disposition filename).
   */
  async getBlob(
    endpoint: string,
    config?: RequestConfig
  ): Promise<{ data: Blob; headers: Headers }> {
    if (DEMO_MODE) {
      const text = "Demo document — files are not stored in demo mode.";
      return { data: new Blob([text], { type: "text/plain" }), headers: new Headers({ "content-type": "text/plain" }) };
    }
    const url = buildUrl(endpoint, config?.params);
    logRequest("GET (blob)", url, undefined, buildHeaders(config));
    const response = await fetchWithAuthRetry("GET", url, undefined, config?.signal, config);
    if (response.status === 401) {
      handleUnauthorized();
      throw { message: "Unauthorized", status: response.status } as ApiError;
    }
    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw {
        message: errorData?.message || errorData?.error || "An error occurred",
        status: response.status,
        data: errorData,
      } as ApiError;
    }
    const blob = await response.blob();
    return { data: blob, headers: response.headers };
  }

  /**
   * Upload file (multipart/form-data)
   */
  async uploadFile<T = any>(
    endpoint: string,
    file: File | FormData,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>("POST", endpoint, { params: config?.params });
    const url = buildUrl(endpoint, config?.params);
    const formBody = file instanceof FormData ? file : (() => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    })();

    const doUpload = (token: string | null) => {
      const headers: HeadersInit = { ...config?.headers };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(url, {
        method: "POST",
        headers,
        body: formBody,
        signal: config?.signal,
      });
    };

    logRequest("POST (File Upload)", url, "[FormData]", {});
    let response = await doUpload(getAuthToken());
    if (response.status === 401 && getRefreshToken()) {
      const tokens = await tryRefresh();
      if (tokens) response = await doUpload(tokens.accessToken);
    }

    try {
      return await handleResponse<T>(response, "POST (File Upload)", url);
    } catch (error: any) {
      logResponse("POST (File Upload)", url, {} as ApiResponse<T>, error);
      throw error;
    }
  }

  /**
   * Request without authentication
   */
  async requestWithoutAuth<T = any>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    if (DEMO_MODE) return mockRequest<T>(method, endpoint, { params: config?.params, body: data });
    const url = buildUrl(endpoint, config?.params);
    const headers = buildHeaders(config, false); // Don't include auth
    const body = data ? JSON.stringify(data) : undefined;

    logRequest(method, url, data, headers);

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: config?.signal,
    });

    try {
      return await handleResponse<T>(response, method, url);
    } catch (error: any) {
      logResponse(method, url, {} as ApiResponse<T>, error);
      throw error;
    }
  }
}

// Export singleton instance
export const httpService = new HttpService();

// Export default for convenience
export default httpService;
