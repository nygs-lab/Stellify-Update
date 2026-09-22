import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, login as loginApi, logout as logoutApi } from "@workspace/api-client-react";
import type { LoginInput, Member } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: Member | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (data: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("stellify_token"));
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: ["/api/auth/me", token],
    },
  });

  // Session timeout: auto-logout after 10 minutes of inactivity
  useEffect(() => {
    if (!token) return;

    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
      }, 10 * 60 * 1000); // 10 minutes
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((name) => window.addEventListener(name, resetTimer));

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((name) => window.removeEventListener(name, resetTimer));
    };
  }, [token]);

  const login = async (data: LoginInput) => {
    const response = await loginApi(data);
    localStorage.setItem("stellify_token", response.token);
    setToken(response.token);
    queryClient.setQueryData(["/api/auth/me", response.token], response.member);
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      // Ignore errors on logout
    }
    localStorage.removeItem("stellify_token");
    setToken(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isAuthenticated: !!user,
        isLoading: isUserLoading,
        mustChangePassword: !!(user?.mustChangePassword),
        login,
        logout,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
