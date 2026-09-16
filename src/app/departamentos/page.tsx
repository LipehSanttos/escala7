"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Layers,
  Plus,
  Tag,
  Palette,
  Check,
  AlertCircle,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
  Lock,
  Unlock,
  KeyRound
} from "lucide-react";

interface Role {
  id: string;
  department_id: string;
  name: string;
  description?: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  roles: Role[];
}

export default function DepartamentosPage() {
  const { user, login } = useAuth();
  const isAdmin = Boolean(user && (user.is_general_admin || user.id === "m_admin_leader"));

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Novo Departamento
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptColor, setDeptColor] = useState("#002F6C");

  // Modal Novo Cargo/Função
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [roleName, setRoleName] = useState("");

  // Modal de Exclusão de Departamento (Exclusivo Administrador)
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal de Acesso com PIN do Administrador
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState("");
  const [adminPinLoading, setAdminPinLoading] = useState(false);

  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      if (data.success) {
        setDepartments(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deptName,
          description: deptDesc,
          color: deptColor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeptName("");
        setDeptDesc("");
        setDeptModalOpen(false);
        setFeedback({ text: `Departamento "${deptName}" cadastrado com sucesso!`, type: "success" });
        loadDepartments();
      } else {
        setFeedback({ text: data.error || "Erro ao criar departamento.", type: "error" });
      }
    } catch {
      setFeedback({ text: "Erro ao conectar para salvar departamento.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !selectedDeptId) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: selectedDeptId,
          name: roleName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRoleName("");
        setRoleModalOpen(false);
        setFeedback({ text: `Função "${roleName}" adicionada com sucesso!`, type: "success" });
        loadDepartments();
      } else {
        setFeedback({ text: data.error || "Erro ao adicionar função.", type: "error" });
      }
    } catch {
      setFeedback({ text: "Erro ao conectar para adicionar função.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!deptToDelete) return;
    if (!isAdmin) {
      setFeedback({
        text: "Acesso negado: Somente o Administrador Geral tem privilégio para excluir departamentos.",
        type: "error",
      });
      return;
    }

    setDeleting(true);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/departments?id=${encodeURIComponent(deptToDelete.id)}&user_id=${encodeURIComponent(
          user?.id || ""
        )}&user_phone=${encodeURIComponent(user?.phone || "")}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (data.success) {
        setFeedback({
          text: data.message || `Departamento "${deptToDelete.name}" excluído com sucesso.`,
          type: "success",
        });
        setDeptToDelete(null);
        await loadDepartments();
      } else {
        setFeedback({
          text: data.error || "Não foi possível excluir o departamento.",
          type: "error",
        });
      }
    } catch {
      setFeedback({
        text: "Erro de conexão ao tentar excluir o departamento.",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPinInput.trim()) return;

    setAdminPinLoading(true);
    setAdminPinError("");
    try {
      const res = await login(adminPinInput.trim());
      if (res.success && (res.data?.is_general_admin || res.data?.id === "m_admin_leader")) {
        setAdminPinModalOpen(false);
        setAdminPinInput("");
        setFeedback({
          text: "Acesso de Administrador confirmado! Privilégio de exclusão liberado.",
          type: "success",
        });
      } else if (res.success) {
        setAdminPinError("Esta credencial não possui privilégio de Administrador Geral.");
      } else {
        setAdminPinError(res.error || "PIN administrativo inválido.");
      }
    } catch {
      setAdminPinError("Erro ao autenticar com o servidor.");
    } finally {
      setAdminPinLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-[#002F6C]" />
            Departamentos e Cargos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os ministérios da igreja e as funções disponíveis para elaboração das escalas.
          </p>
        </div>
        <button
          onClick={() => setDeptModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white font-medium rounded-lg shadow-sm transition text-sm cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Departamento
        </button>
      </div>

      {/* Faixa Informativa de Privilégio do Administrador */}
      {isAdmin ? (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200/70 text-amber-900 rounded-lg shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-900">Perfil de Administrador Ativo</p>
              <p className="text-amber-800 text-xs mt-0.5">
                Conectado como <strong>{user?.name || "Administrador Geral"}</strong>. Você possui privilégio exclusivo para <strong>excluir departamentos</strong> e gerenciar todas as funções da igreja.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-amber-200/80 text-amber-900 font-bold rounded-full text-[11px] border border-amber-300">
            Privilégio Master Liberado
          </span>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 text-slate-700 rounded-lg shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Modo de Consulta / Visualização</p>
              <p className="text-slate-500 text-xs mt-0.5">
                A opção de <strong>exclusão de departamentos</strong> é uma ação de privilégio exclusivo do Administrador.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdminPinModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs hover:bg-slate-50 transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            Desbloquear com PIN de Admin
          </button>
        </div>
      )}

      {/* Banner de Feedback / Mensagens */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid de Departamentos */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#002F6C] mb-3" />
          <p className="text-sm font-medium">Carregando departamentos...</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200 space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-slate-700">Nenhum departamento cadastrado</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Clique no botão acima para criar o primeiro ministério ou departamento da igreja.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                {/* Faixa Colorida do Departamento */}
                <div
                  className="h-2.5 w-full"
                  style={{ backgroundColor: dept.color || "#002F6C" }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white shadow-xs shrink-0"
                        style={{ backgroundColor: dept.color }}
                        title={`Cor temática: ${dept.color}`}
                      />
                      <h2 className="text-lg font-bold text-slate-900 truncate" title={dept.name}>
                        {dept.name}
                      </h2>
                    </div>

                    {/* Botão de Exclusão no Topo (Visível e com privilégio exclusivo do Administrador) */}
                    {isAdmin && (
                      <button
                        onClick={() => setDeptToDelete(dept)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer shrink-0"
                        title={`Excluir departamento ${dept.name} (Privilégio de Administrador)`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {dept.description ? (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                      {dept.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-2">
                      Sem descrição cadastrada.
                    </p>
                  )}

                  {/* Lista de Cargos / Funções */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Funções / Cargos ({dept.roles.length})</span>
                      <button
                        onClick={() => {
                          setSelectedDeptId(dept.id);
                          setRoleModalOpen(true);
                        }}
                        className="text-[#002F6C] hover:underline flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                      {dept.roles.length === 0 ? (
                        <span className="text-xs text-slate-400 italic py-1">
                          Nenhuma função vinculada.
                        </span>
                      ) : (
                        dept.roles.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200"
                          >
                            <Tag className="w-3 h-3 text-slate-400" />
                            {r.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra Inferior de Gestão Exclusiva para Administrador */}
              {isAdmin && (
                <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Privilégio Admin
                  </span>
                  <button
                    onClick={() => setDeptToDelete(dept)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Departamento
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DE DEPARTAMENTO (PRIVILÉGIO DO ADMINISTRADOR) */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Excluir Departamento
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ação com privilégio exclusivo de Administrador
                </p>
              </div>
              <button
                onClick={() => setDeptToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-4 text-sm text-slate-800 space-y-2.5">
              <p>
                Tem certeza de que deseja excluir permanentemente o departamento{" "}
                <strong className="text-slate-900 font-extrabold underline">
                  {deptToDelete.name}
                </strong>?
              </p>
              <p className="text-xs text-rose-700 font-medium leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Todas as <strong>{deptToDelete.roles.length} funções/cargos</strong> associadas, vínculos de voluntários e configurações deste departamento serão removidos do sistema.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Administrador autenticado
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                ID: {deptToDelete.id}
              </span>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeptToDelete(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteDept}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Excluindo departamento...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirmar Exclusão
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DESBLOQUEIO RÁPIDO DE ADMINISTRADOR (VIA PIN) */}
      {adminPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Acesso de Administrador</h3>
                  <p className="text-xs text-slate-500">Informe o PIN mestre da liderança</p>
                </div>
              </div>
              <button
                onClick={() => setAdminPinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAdminLogin} className="space-y-4 pt-1">
              {adminPinError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{adminPinError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  PIN Administrativo
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Digite o PIN..."
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-center tracking-widest font-mono text-base"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdminPinModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adminPinLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-xs"
                >
                  {adminPinLoading ? (
                    "Autenticando..."
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      Desbloquear
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Departamento */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Novo Departamento</h2>
              <button
                onClick={() => setDeptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome do Departamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ministério Jovem (JA)"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Descrição
                </label>
                <textarea
                  placeholder="Finalidade e atuação deste ministério..."
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Cor Temática para a Escala / Imagem
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={deptColor}
                    onChange={(e) => setDeptColor(e.target.value)}
                    className="w-10 h-10 rounded border border-slate-200 cursor-pointer p-0.5"
                  />
                  <span className="text-xs font-mono text-slate-500">{deptColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  {saving ? "Salvando..." : "Criar Departamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Cargo/Função */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Adicionar Cargo / Função</h2>
              <button
                onClick={() => setRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome da Função *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Diácono da Porta"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  {saving ? "Salvando..." : "Adicionar Função"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
