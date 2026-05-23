import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("ai_school_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("ai_school_token", data.access_token);
      localStorage.setItem("ai_school_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("ai_school_token");
    localStorage.removeItem("ai_school_user");
    setUser(null);
  };

  // refresh user on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem("ai_school_token");
    if (token && !user) {
      api.get("/auth/me").then(({ data }) => {
        localStorage.setItem("ai_school_user", JSON.stringify(data));
        setUser(data);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
