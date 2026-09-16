"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface LoggedUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  is_leader: boolean;
  is_general_admin?: boolean;
  led_department_ids?: string[];
  led_department_names?: string[];
  is_author?: boolean;
  authored_schedules_count?: number;
  roles: { id: string; name: string; department_name: string; department_id: string }[];
}

interface AuthContextType {
  user: LoggedUser | null;
  loading: boolean;
  login: (phone: string, password?: string) => Promise<{ success: boolean; error?: string; data?: LoggedUser }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  canManageDepartment: (departmentId: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  logout: () => {},
  canManageDepartment: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sessão salva
    try {
      const saved = localStorage.getItem("iasd_user_session");
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (phone: string, password?: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();

      if (data.success) {
        setUser(data.data);
        localStorage.setItem("iasd_user_session", JSON.stringify(data.data));
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      return { success: false, error: "Erro de conexão ao autenticar." };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: "Usuário deslogado." };
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: "Erro ao conectar com o servidor para alterar senha." };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("iasd_user_session");
  };

  const canManageDepartment = (departmentId: string) => {
    if (!user) return false;
    if (user.is_general_admin) return true;
    if (!user.is_leader) return false;
    return (user.led_department_ids || []).includes(departmentId);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout, canManageDepartment }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);