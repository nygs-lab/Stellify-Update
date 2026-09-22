import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setAuthTokenGetter,
  useGetMe,
  useLogin,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { requestNotificationPermissionsOnce, syncStreakReminder, registerExpoPushToken, syncTimezone } from "@/hooks/useStreakReminder";

const TOKEN_KEY = "stellify_token";

let _currentToken: string | null = null;

setAuthTokenGetter(() => _currentToken);

interface AuthContextValue {
  token: string | null;
  member: Member | null;
  isLoading: boolean;
  login: (churchId: string, password: string) => Promise<{ passwordChangeRequired: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const loginMutation = useLogin();

  const meQuery = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: token !== null,
      retry: false,
    },
  });

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((stored) => {
      if (stored) {
        _currentToken = stored;
        setToken(stored);
      }
      setIsBootstrapping(false);
    });
  }, []);

  const login = useCallback(async (churchId: string, password: string) => {
    const result = await loginMutation.mutateAsync({
      data: { churchId, password },
    });
    const tok = result.token;
    _currentToken = tok;
    await AsyncStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    syncTimezone().catch(() => {});
    requestNotificationPermissionsOnce()
      .then((granted) => {
        if (granted) {
          syncStreakReminder().catch(() => {});
          registerExpoPushToken().catch(() => {});
        }
      })
      .catch(() => {});
    return { passwordChangeRequired: result.passwordChangeRequired === true };
  }, [loginMutation]);

  const logout = useCallback(async () => {
    _currentToken = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const member = meQuery.data ?? null;
  const isLoading = isBootstrapping || (token !== null && meQuery.isLoading);

  const value = useMemo<AuthContextValue>(
    () => ({ token, member, isLoading, login, logout }),
    [token, member, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
