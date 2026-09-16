"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Check,
  AlertCircle,
  Save,
  Lock,
  Unlock,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Phone,
  AlertTriangle,
  LogOut
} from "lucide-react";
import { IasdLogo } from "@/components/IasdLogo";
import { useAuth } from "@/contexts/AuthContext";

export default function ConfiguracoesPage() {
  const { user, login, logout } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    district: "",
    city: "",
    state: "",
  });
  const [authorizedAuthors, setAuthorizedAuthors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Estado de desbloqueio local via PIN ou identificação direta
  const [directPin, setDirectPin] = useState<string>("");
  const [authInput, setAuthInput] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/church")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setFormData({
            name: res.data.name || "",
            district: res.data.district || "",
            city: res.data.city || "",
            state: res.data.state || "",
          });
          if (res.authorized_authors) {
            setAuthorizedAuthors(res.authorized_authors);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Determinar se o usuário atual é o Administrador
  const isUserAdmin = Boolean(
    user && (user.is_general_admin || user.id === "m_admin_leader")
  );
  const canEdit = isUserAdmin;

  const authorDisplayName = isUserAdmin
    ? `${user?.name || "Administrador Geral"}`
    : null;

  // Login / Desbloqueio inline com PIN de administrador ou login
  const handleInlineAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const value = authInput.trim();

    if (!value) {
      setAuthError("Informe o PIN do Administrador para desbloquear a edição.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await login(value);
      if (res.success) {
        if (res.data?.is_general_admin) {
          setDirectPin(value);
          setAuthInput("");
          setMessage({
            text: "Acesso autorizado com sucesso como Administrador!",
            type: "success"
          });
        } else {
          setAuthError(`Acesso restrito: Conectado como ${res.data?.name} (${res.data?.is_leader ? "Líder" : "Voluntário"}). Somente o Administrador pode alterar o nome da igreja e as configurações.`);
        }
      } else {
        setAuthError(res.error || "Credencial ou PIN não autorizado.");
      }
    } catch (err) {
      setAuthError("Erro ao conectar com o servidor.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRevokeDirectPin = () => {
    setDirectPin("");
    if (user) {
      logout();
    }
    setMessage({ text: "Sessão de edição de administrador encerrada.", type: "info" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setMessage({
        text: "Acesso restrito: Somente o Administrador pode alterar o nome da igreja e as configurações.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/church", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          user_id: user?.id,
          user_phone: user?.phone,
          pin: directPin || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          text: `Configurações da igreja atualizadas com sucesso por ${authorDisplayName || "você"}!`,
          type: "success"
        });
      } else {
        setMessage({ text: data.error || "Erro ao salvar configurações.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Erro ao conectar com o servidor.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-7 h-7 text-[#002F6C]" />
              Configurações da Igreja Local
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Defina o nome da igreja, distrito, cidade e estado para exibição nas escalas e na arte de compartilhamento.
            </p>
          </div>

          {/* Status Badge de Autorização */}
          <div>
            {canEdit ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Edição Liberada
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                Modo Somente Leitura
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mensagens de Notificação */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-2 text-sm ${message.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : message.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-red-50 border-red-200 text-red-800"
            }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : message.type === "info" ? (
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-semibold underline opacity-70 hover:opacity-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* BANNER DE AUTORIZAÇÃO / CONTROLE DE ACESSO */}
      {canEdit ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Administrador Autorizado
              </div>
              <div className="text-sm font-semibold text-emerald-950">
                {authorDisplayName}
              </div>
              <div className="text-xs text-emerald-700">
                Você possui permissão total de Administrador para editar o nome da igreja e todas as configurações.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRevokeDirectPin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-medium transition cursor-pointer self-start sm:self-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            Encerrar Edição
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Somente o Administrador pode alterar o nome da igreja e as configurações
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                As informações abaixo definem o nome oficial da igreja, distrito e localidade para todas as escalas e artes exportadas.
                Somente o Administrador do sistema possui autorização para editá-las.
              </p>

              {/* Caixa de Desbloqueio Inline para o Administrador */}
              <form onSubmit={handleInlineAuth} className="mt-4 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row gap-2 max-w-lg">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={authInput}
                    onChange={(e) => {
                      setAuthInput(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    placeholder="Digite o PIN do Administrador"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002F6C] focus:border-transparent font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {authLoading ? "Verificando..." : "Desbloquear como Admin"}
                </button>
              </form>

              {authError && (
                <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {authError}
                </div>
              )}

              {user && !user.is_general_admin && (
                <div className="mt-3 p-2.5 bg-white/80 rounded-lg border border-amber-200 text-xs text-slate-600">
                  Você está conectado como <strong className="text-slate-800">{user.name}</strong> ({user.is_leader ? "Líder de Departamento" : "Voluntário"}). Somente o perfil de Administrador Geral possui permissão para editar os dados da igreja.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulário Principal */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        {/* Identidade Institucional */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="p-3 bg-[#002F6C] rounded-xl text-amber-400 shadow-sm">
            <IasdLogo className="w-12 h-12" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-400">Identidade Institucional</div>
            <div className="text-lg font-bold text-slate-800">Igreja Adventista do Sétimo Dia</div>
            <div className="text-xs text-slate-500">Logotipo oficial configurado para uso nas artes exportáveis.</div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-sm">Carregando dados da igreja...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome da Igreja */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Nome da Igreja Local (Bairro) *
                </label>
                {!canEdit && (
                  <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3" /> Exclusivo do Administrador
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                disabled={!canEdit}
                placeholder="Ex: IASD Central de Curitiba / IASD Jd. das Flores"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm transition ${canEdit
                  ? "bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                  : "bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed select-all"
                  }`}
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Este nome aparecerá no cabeçalho das escalas compartilhadas e na arte exportada.
              </span>
            </div>

            {/* Grid de Distrito, Cidade e Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Distrito Pastoral
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder="Ex: Distrito Central"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition ${canEdit
                    ? "bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                    : "bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed select-all"
                    }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder="Ex: Boa Vista"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm transition ${canEdit
                    ? "bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                    : "bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed select-all"
                    }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Estado (UF)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  placeholder="Ex: RR"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm uppercase transition ${canEdit
                    ? "bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                    : "bg-slate-50 text-slate-600 border-slate-200 cursor-not-allowed select-all"
                    }`}
                />
              </div>
            </div>

            {/* Ações de Formulário */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {!canEdit && (
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    Somente o Administrador pode salvar alterações nas configurações.
                  </span>
                )}
                {canEdit && (
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Unlock className="w-3.5 h-3.5" />
                    Alterações serão salvas e refletidas em todas as escalas e artes exportadas.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!canEdit || saving}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm ${canEdit
                  ? "bg-[#002F6C] hover:bg-[#002454] text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : canEdit ? "Salvar Configurações" : "Salvar Configurações (Requer Admin)"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
