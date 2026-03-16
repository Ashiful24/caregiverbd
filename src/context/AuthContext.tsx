"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect, useRef } from "react";
import { isValidEmail, validateBangladeshiPhone } from "../utils/phoneValidation";
import { getJwtExpiryMs, SESSION_EXPIRY_BUFFER_MS, PROACTIVE_REFRESH_BUFFER_MS } from "../utils/auth";
import { authApi } from "../services/api";
import { setAuthTokens } from "../services/httpService";
import { initFcm } from "../services/fcm";

type User = {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
} | null;

type AuthContextType = {
  user: User;
  isAuthenticated: boolean;
  login: (emailOrPhone: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proactiveRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSessionTimeout = () => {
    if (sessionTimeoutRef.current !== null) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  };

  const clearProactiveRefresh = () => {
    if (proactiveRefreshRef.current !== null) {
      clearTimeout(proactiveRefreshRef.current);
      proactiveRefreshRef.current = null;
    }
  };

  const clearAllAuthTimers = () => {
    clearSessionTimeout();
    clearProactiveRefresh();
  };

  const clearAuthStorage = () => {
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_refresh_token");
    localStorage.removeItem("auth_provider_type");
    localStorage.removeItem("auth_provider_category");
    localStorage.removeItem("auth_employment_type");
    sessionStorage.removeItem("auth_user");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("auth_refresh_token");
    sessionStorage.removeItem("auth_provider_type");
    sessionStorage.removeItem("auth_provider_category");
    sessionStorage.removeItem("auth_employment_type");
  };

  /** Schedule logout at token expiry (prefer refresh token so session lasts until refresh expires). */
  const scheduleSessionLogout = (accessToken: string, refreshToken: string | null) => {
    clearSessionTimeout();
    const tokenToUse = refreshToken ?? accessToken;
    const expiryMs = getJwtExpiryMs(tokenToUse);
    if (expiryMs === null) return;
    const nowMs = Date.now();
    const delayMs = Math.max(0, expiryMs - nowMs - SESSION_EXPIRY_BUFFER_MS);
    sessionTimeoutRef.current = setTimeout(() => {
      sessionTimeoutRef.current = null;
      clearAuthStorage();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }, delayMs);
  };

  /** Refresh access token before it expires; on success reschedule session and proactive refresh. */
  const scheduleProactiveRefresh = (accessToken: string) => {
    clearProactiveRefresh();
    const expiryMs = getJwtExpiryMs(accessToken);
    if (expiryMs === null) return;
    const nowMs = Date.now();
    const delayMs = Math.max(0, expiryMs - nowMs - PROACTIVE_REFRESH_BUFFER_MS);
    proactiveRefreshRef.current = setTimeout(async () => {
      proactiveRefreshRef.current = null;
      const refreshToken = localStorage.getItem("auth_refresh_token");
      if (!refreshToken) return;
      try {
        const res = await authApi.refresh(refreshToken);
        const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
        setAuthTokens(newAccess, newRefresh);
        scheduleSessionLogout(newAccess, newRefresh);
        scheduleProactiveRefresh(newAccess);
      } catch {
        clearAllAuthTimers();
      }
    }, delayMs);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedUser = localStorage.getItem("auth_user");
        const authToken = localStorage.getItem("auth_token");
        const refreshToken = localStorage.getItem("auth_refresh_token");

        if (!savedUser) {
          setIsLoading(false);
          return;
        }

        let accessToken = authToken;
        let refresh = refreshToken;

        if (accessToken) {
          const accessExpiryMs = getJwtExpiryMs(accessToken);
          const nowMs = Date.now();
          if (accessExpiryMs !== null && accessExpiryMs - SESSION_EXPIRY_BUFFER_MS > nowMs) {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            scheduleSessionLogout(accessToken, refresh);
            scheduleProactiveRefresh(accessToken);
            setIsLoading(false);
            return;
          }
        }

        if (refresh) {
          try {
            const res = await authApi.refresh(refresh);
            accessToken = res.data.accessToken;
            refresh = res.data.refreshToken;
            setAuthTokens(accessToken, refresh);
          } catch {
            clearAuthStorage();
            setIsLoading(false);
            return;
          }
        }

        if (accessToken) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          scheduleSessionLogout(accessToken, refresh);
          scheduleProactiveRefresh(accessToken);
        } else {
          clearAuthStorage();
        }
      } catch {
        clearAuthStorage();
      } finally {
        setIsLoading(false);
      }
    };

    const handleUnauthorized = () => {
      clearAllAuthTimers();
      setUser(null);
    };

    const handleLogoutEvent = () => {
      clearAllAuthTimers();
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    window.addEventListener("auth:logout", handleLogoutEvent);

    checkAuth();

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
      window.removeEventListener("auth:logout", handleLogoutEvent);
      clearAllAuthTimers();
    };
  }, []);

  const login = async (emailOrPhone: string, password: string, rememberMe: boolean = false) => {
    try {
      // Validate input
      if (!emailOrPhone?.trim() || !password) {
        throw new Error("Email/Phone and password are required");
      }

      const isEmailInput = isValidEmail(emailOrPhone.trim());
      const isPhoneInput = validateBangladeshiPhone(emailOrPhone.trim());

      if (!isEmailInput && !isPhoneInput) {
        throw new Error(
          "Please enter a valid email or Bangladeshi phone number (e.g., 01712345678 or user@example.com)"
        );
      }

      // Call login API (POST /v1/users/login)
      const response = await authApi.login({
        identifier: emailOrPhone.trim(),
        password,
      });

      const responseData = response.data;
      const accessToken = responseData.accessToken;
      const refreshToken = responseData.refreshToken ?? null;
      const userData = responseData.user;
      const providerType = responseData.providerType;
      const providerCategory = responseData.providerCategory;
      const employmentType = responseData.employmentType;

      if (!accessToken) {
        throw new Error("Login failed: No access token received from server");
      }

      if (!userData) {
        throw new Error("Login failed: No user data received from server");
      }

      setUser(userData);
      localStorage.setItem("auth_user", JSON.stringify(userData));
      localStorage.setItem("auth_token", accessToken);
      if (refreshToken) localStorage.setItem("auth_refresh_token", refreshToken);

      scheduleSessionLogout(accessToken, refreshToken);
      scheduleProactiveRefresh(accessToken);

      if (providerType) localStorage.setItem("auth_provider_type", providerType);
      if (providerCategory) localStorage.setItem("auth_provider_category", providerCategory);
      if (employmentType) localStorage.setItem("auth_employment_type", employmentType);

      if (rememberMe) {
        sessionStorage.setItem("auth_user", JSON.stringify(userData));
        sessionStorage.setItem("auth_token", accessToken);
        if (refreshToken) sessionStorage.setItem("auth_refresh_token", refreshToken);
        if (providerType) sessionStorage.setItem("auth_provider_type", providerType);
        if (providerCategory) sessionStorage.setItem("auth_provider_category", providerCategory);
        if (employmentType) sessionStorage.setItem("auth_employment_type", employmentType);
      }

      // Register web device with backend for push notifications (non-blocking)
      initFcm().catch(() => {});
    } catch (error: any) {
      let errorMessage = "Failed to sign in. Please try again.";

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = Array.isArray(error.data.message)
          ? error.data.message.join(". ")
          : error.data.message;
      } else if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.data?.errors && Array.isArray(error.data.errors)) {
        errorMessage = error.data.errors.map((e: { message?: string }) => e.message || e).join(". ");
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error?.status === 0 || error?.name === "TypeError") {
        errorMessage = "Network error. Please check your connection and try again.";
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call when signup endpoint is ready
      // For now, we'll simulate registration
      
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Basic validation (replace with actual API call)
      if (!email || !password || !firstName || !lastName) {
        throw new Error("All fields are required");
      }

      // TODO: Call actual signup API when available
      // const response = await authApi.signup({ email, password, firstName, lastName });
      // const userData = response.data.user;
      // const token = response.data.token;

      // For now, create a temporary user object matching the User type
      // This will be replaced with actual API response
      const userData: User = {
        id: 0, // Temporary - will come from API
        email,
        username: email.split("@")[0],
        firstName,
        lastName,
        role: "USER",
        isActive: true,
      };

      setUser(userData);
      localStorage.setItem("auth_user", JSON.stringify(userData));
      localStorage.setItem("auth_token", "demo_token_" + Date.now());
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    clearAllAuthTimers();
    try {
      // Call logout API if user is authenticated
      if (localStorage.getItem("auth_token")) {
        try {
          await authApi.logout();
        } catch {
          // Continue with logout even if API call fails
        }
      }
    } catch {
      // Logout continues to clear local state
    } finally {
      // Clear auth data regardless of API call result
      setUser(null);
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_refresh_token");
      localStorage.removeItem("auth_provider_type");
      localStorage.removeItem("auth_provider_category");
      localStorage.removeItem("auth_employment_type");
      sessionStorage.removeItem("auth_user");
      sessionStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_refresh_token");
      sessionStorage.removeItem("auth_provider_type");
      sessionStorage.removeItem("auth_provider_category");
      sessionStorage.removeItem("auth_employment_type");

      // Dispatch logout event for components to listen to
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
