"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IasdLogo } from "./IasdLogo";
import { 
  CalendarDays, 
  Users, 
  Layers, 
  Settings, 
  LogOut, 
  PlusCircle, 
  Menu, 
  X,
  Phone,
  Bell,
  KeyRound,
  Lock,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const pathname = usePathname();
  const { user, login, logout, changePassword } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Modal de Alteração de Senha
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [churchInfo, setChurchInfo] = useState({
    name: "Igreja Adventista do Sétimo Dia",
    district: "Distrito Central"
  });

  useEffect(() => {
    fetch("/api/church")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setChurchInfo(data.data);
        }
      })
      .catch((err) => console.error("Erro ao carregar dados da igreja:", err));
  }, []);

  // Navegação dinâmica por papel
  const navLinks = React.useMemo(() => {
    // Inicialmente (deslogado): Apenas a visualização pública de escalas
    if (!user) {
      return [
        { href: "/", label: "Escalas Públicas", icon: CalendarDays }
      ];
    }

    // Voluntário comum (não líder): Apenas Escalas públicas
    if (!user.is_leader) {
      return [
        { href: "/", label: "Escalas Públicas", icon: CalendarDays }
      ];
    }

    // Líder de departamento ou Administrador Geral
    const links = [
      { href: "/", label: "Escalas Públicas", icon: CalendarDays },
      { href: "/escalas/nova", label: "Criar Escala", icon: PlusCircle },
      { href: "/membros", label: "Membros", icon: Users },
      { href: "/lembretes", label: "Lembretes Pré-Culto", icon: Bell },
    ];

    if (user.is_general_admin) {
      links.push(
        { href: "/departamentos", label: "Departamentos", icon: Layers },
        { href: "/configuracoes", label: "Configurações", icon: Settings }
      );
    }

    return links;
  }, [user]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    const res = await login(loginPhone, loginPassword);
    setLoggingIn(false);

    if (res.success) {
      setLoginModalOpen(false);
      setLoginPhone("");
      setLoginPassword("");
    } else {
      setLoginError(res.error || "Erro ao fazer login.");
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Informe sua senha atual.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("A nova senha deve ter no mínimo 4 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da nova senha não confere.");
      return;
    }

    setSavingPassword(true);
    const res = await changePassword(currentPassword, newPassword);
    setSavingPassword(false);

    if (res.success) {
      setPasswordSuccess(res.message || "Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess("");
      }, 1800);
    } else {
      setPasswordError(res.error || "Erro ao alterar senha.");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#002F6C] text-white shadow-md border-b border-[#001D44]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome da Igreja */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="bg-white/10 p-1.5 rounded-lg group-hover:bg-white/20 transition">
              <IasdLogo className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-blue-200 font-semibold leading-tight">
                Escalas Eclesiásticas
              </div>
              <div className="text-base font-bold text-white leading-tight truncate max-w-[170px] sm:max-w-xs md:max-w-md">
                {churchInfo.name}
              </div>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-white/20 text-white shadow-inner"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Botão de Perfil / Login com WhatsApp */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg text-xs">
                <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-bold flex items-center justify-center text-xs shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="max-w-[120px] truncate font-semibold" title={user.name}>
                    {user.name}
                  </div>

                  {/* Botão posicionado logo ao lado do nome do usuário */}
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordError("");
                      setPasswordSuccess("");
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-300/30 text-[10px] font-bold transition shadow-2xs cursor-pointer shrink-0"
                    title="Alterar Senha de Acesso"
                  >
                    <KeyRound className="w-3 h-3 text-amber-300" />
                    <span>Alterar Senha</span>
                  </button>
                </div>
                {user.is_general_admin ? (
                  <span className="bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    Admin Geral
                  </span>
                ) : user.is_leader ? (
                  <span
                    className="bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold max-w-[130px] truncate"
                    title={`Líder: ${user.led_department_names?.join(", ") || "Designado"}`}
                  >
                    Líder: {user.led_department_names?.[0] || "Departamento"}
                  </span>
                ) : (
                  <span className="bg-blue-400/20 text-blue-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
                    Voluntário
                  </span>
                )}
                <button
                  onClick={logout}
                  className="text-blue-200 hover:text-white ml-1 p-0.5 cursor-pointer"
                  title="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setLoginError("");
                  setLoginModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                Entrar no Sistema
              </button>
            )}
          </div>

          {/* Botão Menu Mobile */}
          <div className="flex lg:hidden items-center gap-2">
            {!user && (
              <button
                onClick={() => {
                  setLoginError("");
                  setLoginModalOpen(true);
                }}
                className="p-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-blue-100 hover:text-white hover:bg-white/10 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Dropdown Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#002454] border-t border-[#001D44] px-2 pt-2 pb-3 space-y-1">
          {user && (
            <div className="px-3 py-2 border-b border-white/10 flex flex-col gap-2 text-xs text-blue-200">
              <div className="flex items-center justify-between">
                <span>Logado como: <strong>{user.name}</strong></span>
                <button onClick={logout} className="text-red-300 underline font-semibold cursor-pointer">Sair</button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPasswordError("");
                  setPasswordSuccess("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-300/30 text-xs font-bold w-fit cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Alterar Senha
              </button>
            </div>
          )}
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-base font-medium ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal de Login com WhatsApp + Senha */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs text-slate-900">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Acesso do Membro</h3>
              </div>
              <button
                onClick={() => setLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Informe seu <strong>WhatsApp</strong> e sua <strong>senha de acesso</strong> para entrar no sistema.
            </p>

            {loginError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  WhatsApp com DDD ou PIN
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: (00) 00000-0000 ou PIN de acesso"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  placeholder="Digite sua senha de acesso"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loggingIn}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {loggingIn ? "Verificando..." : "Entrar no Sistema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Alteração de Senha */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs text-slate-900">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Alterar Minha Senha</h3>
              </div>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Defina uma nova senha pessoal para proteger seu acesso ao sistema.
            </p>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Senha Atual *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nova Senha * (mínimo 4 caracteres)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Digite a nova senha desejada"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Confirmar Nova Senha *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] font-mono text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {savingPassword ? "Salvando..." : "Salvar Nova Senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}