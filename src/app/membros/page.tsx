"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Trash2,
  Filter,
  Check,
  Lock,
  ShieldAlert,
  X,
  Clock,
  AlertTriangle,
  Star,
  ChevronDown,
  Crown,
  Baby
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Department {
  id: string;
  name: string;
  color: string;
  roles: Role[];
}

interface Role {
  id: string;
  name: string;
  department_id: string;
}

interface Member {
  id: string;
  name: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_leader: boolean;
  is_child?: boolean;
  parent_id?: string | null;
  parent_name?: string;
  parent_phone?: string;
  children?: { id: string; name: string }[];
  leader_status?: "none" | "pending" | "approved";
  leader_nominated_by?: string;
  roles: { role_id: string; role_name: string; department_name: string; department_color: string }[];
  departments: { department_id: string; department_name: string; is_department_leader: number }[];
}

export default function MembrosPage() {
  const { user, login } = useAuth();
  const isLeader = Boolean(user && user.is_leader);

  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");

  // Menu de Liderança Rápida para o Administrador
  const [activeLeaderMenuId, setActiveLeaderMenuId] = useState<string | null>(null);

  // Auth Modal State para Líderes Deslogados
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authing, setAuthing] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    is_active: true,
    is_leader: false,
    is_child: false,
    parent_id: "",
    department_ids: [] as string[],
    leader_department_ids: [] as string[],
    role_ids: [] as string[],
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLeaderAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthing(true);
    const res = await login(authInput, authPassword);
    setAuthing(false);
    if (res.success) {
      setAuthModalOpen(false);
      setAuthInput("");
      setAuthPassword("");
    } else {
      setAuthError(res.error || "Número, senha ou PIN não autorizados.");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resMembers, resDepts] = await Promise.all([
        fetch("/api/members").then((r) => r.json()),
        fetch("/api/departments").then((r) => r.json()),
      ]);

      if (resMembers.success) setMembers(resMembers.data);
      if (resDepts.success) setDepartments(resDepts.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Administrador aprova líder sem necessidade de confirmação
  const handleApproveLeader = async (memberId: string, memberName: string) => {
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_leader",
          id: memberId,
          user_id: user?.id,
          user_phone: user?.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao aprovar líder.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // Administrador recusa indicação sem confirmação
  const handleRejectLeader = async (memberId: string, memberName: string) => {
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_leader",
          id: memberId,
          user_id: user?.id,
          user_phone: user?.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao recusar indicação.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // Administrador define qualquer membro para líder de qualquer departamento sem confirmação
  const handleSetDeptLeader = async (memberId: string, deptId: string) => {
    setActiveLeaderMenuId(null);
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_dept_leader",
          id: memberId,
          department_id: deptId,
          user_id: user?.id,
          user_phone: user?.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao definir líder do departamento.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Administrador define qualquer membro para líder geral sem confirmação
  const handleSetGeneralLeader = async (memberId: string, deptId?: string) => {
    setActiveLeaderMenuId(null);
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_leader",
          id: memberId,
          department_id: deptId,
          user_id: user?.id,
          user_phone: user?.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao definir líder.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Administrador altera membro para voluntário sem confirmação
  const handleDemoteLeader = async (memberId: string) => {
    setActiveLeaderMenuId(null);
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "demote_leader",
          id: memberId,
          user_id: user?.id,
          user_phone: user?.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao alterar para voluntário.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openNewMemberModal = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!user.is_leader && !user.is_general_admin) {
      alert(`Acesso restrito: Você está conectado como voluntário (${user.name}). Somente um líder ou responsável tem permissão para cadastrar membros.`);
      return;
    }
    setEditingMember(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      is_active: true,
      is_leader: false,
      is_child: false,
      parent_id: "",
      department_ids: [],
      leader_department_ids: [],
      role_ids: [],
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEditMemberModal = (m: Member) => {
    if (!isLeader && !user?.is_general_admin) {
      if (!user) {
        setAuthModalOpen(true);
      } else {
        alert(`Acesso restrito: Você está conectado como voluntário (${user.name}). Somente líderes ou responsáveis podem alterar dados de membros.`);
      }
      return;
    }
    setEditingMember(m);
    const leaderDeptIds = m.departments
      .filter((d) => d.is_department_leader === 1)
      .map((d) => d.department_id);

    setFormData({
      name: m.name,
      phone: m.phone,
      email: m.email || "",
      is_active: m.is_active,
      is_leader: Boolean(m.is_leader || m.leader_status === "approved" || m.leader_status === "pending"),
      is_child: Boolean(m.is_child),
      parent_id: m.parent_id || "",
      department_ids: m.departments.map((d) => d.department_id),
      leader_department_ids: leaderDeptIds,
      role_ids: m.roles.map((r) => r.role_id),
    });
    setFormError("");
    setModalOpen(true);
  };

  const toggleLeaderDeptSelection = (deptId: string) => {
    setFormData((prev) => {
      const isCurrentlyLeader = prev.leader_department_ids.includes(deptId);
      const newLeaderDepts = isCurrentlyLeader
        ? prev.leader_department_ids.filter((id) => id !== deptId)
        : [...prev.leader_department_ids, deptId];

      const newDeptIds = prev.department_ids.includes(deptId)
        ? prev.department_ids
        : [...prev.department_ids, deptId];

      return {
        ...prev,
        department_ids: newDeptIds,
        leader_department_ids: newLeaderDepts,
        is_leader: newLeaderDepts.length > 0 || prev.is_leader,
      };
    });
  };

  const toggleRoleSelection = (roleId: string, deptId: string) => {
    const isSelected = formData.role_ids.includes(roleId);
    let newRoles = isSelected
      ? formData.role_ids.filter((id) => id !== roleId)
      : [...formData.role_ids, roleId];

    // Auto-select department if any role is selected
    let newDepts = [...formData.department_ids];
    if (!isSelected && !newDepts.includes(deptId)) {
      newDepts.push(deptId);
    }

    setFormData({ ...formData, role_ids: newRoles, department_ids: newDepts });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!isLeader && !user?.is_general_admin) {
      setFormError("Acesso restrito: Somente líderes ou responsáveis autenticados podem cadastrar ou alterar membros.");
      return;
    }

    if (!formData.name.trim()) {
      setFormError("Por favor, informe o nome do membro.");
      return;
    }

    if (formData.is_child) {
      if (!formData.parent_id) {
        setFormError("Por favor, selecione o adulto responsável para vincular a criança.");
        return;
      }
    } else {
      if (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 10) {
        setFormError("Informe um número de WhatsApp válido com DDD.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const url = "/api/members";
      const method = editingMember ? "PUT" : "POST";
      const payload = {
        ...(editingMember ? { ...formData, id: editingMember.id } : formData),
        user_id: user?.id,
        user_phone: user?.phone,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setFormError(data.error || "Ocorreu um erro ao salvar o membro.");
      } else {
        setModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setFormError(err.message || "Erro na requisição.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isLeader) {
      if (!user) {
        setAuthModalOpen(true);
      } else {
        alert(`Acesso restrito: Você está conectado como ${user.name}. Apenas líderes ou responsáveis podem remover membros.`);
      }
      return;
    }

    if (!confirm(`Deseja realmente remover o membro "${name}"?`)) return;

    try {
      const authQuery = `&user_id=${encodeURIComponent(user?.id || "")}&user_phone=${encodeURIComponent(user?.phone || "")}`;
      const res = await fetch(`/api/members?id=${id}${authQuery}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao remover membro.");
      }
    } catch (err) {
      alert("Erro ao tentar excluir membro.");
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      (m.parent_name && m.parent_name.toLowerCase().includes(search.toLowerCase())) ||
      (m.children && m.children.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))) ||
      m.roles.some((r) => r.role_name.toLowerCase().includes(search.toLowerCase()));

    const matchesDept =
      selectedDeptFilter === "all" ||
      m.departments.some((d) => d.department_id === selectedDeptFilter);

    return matchesSearch && matchesDept;
  });

  const pendingNominations = members.filter((m) => m.leader_status === "pending");

  return (
    <div className="space-y-6">
      {/* Banner de Status de Acesso */}
      {!user ? (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Modo Diretório Público:</span> Você está deslogado. Apenas usuários líderes ou responsáveis logados podem cadastrar ou editar membros.
            </div>
          </div>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="self-start sm:self-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition shadow-2xs shrink-0 cursor-pointer"
          >
            Entrar como Líder
          </button>
        </div>
      ) : !isLeader ? (
        <div className="bg-slate-100 border border-slate-200 p-3.5 rounded-xl flex items-center gap-2.5 text-xs text-slate-700 shadow-2xs">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
          <div>
            Conectado como <strong className="text-slate-900">{user.name}</strong> (Voluntário). O cadastro e alteração de membros são restritos aos líderes e diretores de departamento.
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-950 font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Conectado como <strong className="text-emerald-900">{user.name}</strong> ({user.is_general_admin ? "Líder Geral" : `Líder: ${user.led_department_names?.join(", ") || "Departamento Designado"}`}) — Acesso liberado para cadastro e gerenciamento de membros.
            </span>
          </div>
        </div>
      )}

      {/* Banner de Indicações de Liderança Pendentes (Admin / Líder) */}
      {(isLeader || user?.is_general_admin) && pendingNominations.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-950">
                  Indicações de Líder Aguardando Aprovação ({pendingNominations.length})
                </h2>
                <p className="text-xs text-amber-800">
                  Membros indicados por líderes que necessitam de aprovação do administrador para atuarem como líderes oficiais.
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 bg-amber-200 text-amber-900 font-bold rounded-full self-start sm:self-auto">
              Aprovação de Liderança
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-amber-200">
            {pendingNominations.map((pm) => (
              <div
                key={pm.id}
                className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900">{pm.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" /> Pendente
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {pm.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                  </div>
                  {pm.leader_nominated_by && (
                    <div className="text-xs text-amber-900 bg-amber-50/80 p-1.5 rounded mt-2 border border-amber-200/60">
                      <span className="font-semibold">Indicado por:</span> {pm.leader_nominated_by}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleApproveLeader(pm.id, pm.name)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aprovar Líder
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectLeader(pm.id, pm.name)}
                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 rounded text-xs font-semibold transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-[#002F6C]" />
            Membros da Igreja
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre os membros, seus telefones de WhatsApp e vincule aos seus cargos por departamento.
          </p>
        </div>
        {isLeader ? (
          <button
            onClick={openNewMemberModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white font-medium rounded-lg shadow-sm transition text-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Novo Membro
          </button>
        ) : (
          <button
            onClick={openNewMemberModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg border border-slate-300 shadow-xs transition text-sm cursor-pointer"
            title={!user ? "Faça login como líder para cadastrar membros" : "Permissão exclusiva para líderes"}
          >
            <Lock className="w-4 h-4 text-amber-600" />
            Novo Membro <span className="text-xs text-amber-700 font-bold">(Requer Líder)</span>
          </button>
        )}
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="md:col-span-2 relative">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
          >
            <option value="all" className="text-slate-900 bg-white">Todos os Departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} className="text-slate-900 bg-white">
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela / Grid de Membros */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Carregando lista de membros...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Nenhum membro encontrado</h3>
          <p className="text-sm text-slate-500 mt-1">
            Tente ajustar os filtros de busca ou cadastre um novo membro.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Nome / Contato</th>
                  <th className="px-6 py-3.5">Status & Perfil</th>
                  <th className="px-6 py-3.5">Cargos / Funções Vinculadas</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition">
                    {/* Nome e WhatsApp */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        {m.is_child && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                            <Baby className="w-3 h-3 text-purple-600" /> Criança / Dependente
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-slate-500 mt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!user ? (
                            <span
                              className="inline-flex items-center gap-1 text-slate-400 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60"
                              title="Contato protegido: Faça login para visualizar o número de telefone"
                            >
                              <Lock className="w-3 h-3 text-slate-400" />
                              🔒 Contato Protegido
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {m.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                            </span>
                          )}
                          {user && m.email && (
                            <span className="flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {m.email}
                            </span>
                          )}
                        </div>

                        {m.is_child ? (
                          <div className="text-[11px] text-purple-900 bg-purple-50/80 px-2 py-1 rounded border border-purple-200/80 inline-flex items-center gap-1.5 w-fit">
                            <span>👨‍👧 <strong>Responsável (Vínculo Principal):</strong> {m.parent_name || "Adulto Vinculado"}</span>
                          </div>
                        ) : (
                          m.children && m.children.length > 0 && (
                            <div className="text-[11px] text-blue-900 bg-blue-50/80 px-2 py-1 rounded border border-blue-200/80 inline-flex items-center gap-1.5 w-fit">
                              <span>👶 <strong>Responsável por:</strong> {m.children.map((c) => c.name).join(", ")}</span>
                            </div>
                          )
                        )}
                      </div>
                    </td>

                    {/* Status e Perfil */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {m.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Inativo
                          </span>
                        )}

                        {m.is_child ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            <Baby className="w-3 h-3 text-purple-600" /> Criança / Dependente
                          </span>
                        ) : m.leader_status === "pending" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" /> Indicação Pendente
                            </span>
                            {m.leader_nominated_by && (
                              <span className="block text-[10px] text-slate-500">
                                Por: {m.leader_nominated_by}
                              </span>
                            )}
                            {(isLeader || user?.is_general_admin) && (
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveLeader(m.id, m.name)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                  title="Aprovar como Líder Oficial imediatamente"
                                >
                                  Aprovar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectLeader(m.id, m.name)}
                                  className="px-1.5 py-0.5 bg-slate-200 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded text-[10px] font-semibold cursor-pointer"
                                  title="Recusar indicação imediatamente"
                                >
                                  Recusar
                                </button>
                              </div>
                            )}
                          </div>
                        ) : m.is_leader || m.leader_status === "approved" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Líder Oficial
                            </span>
                            {/* Badges dos Departamentos Liderados */}
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {m.departments.filter(d => d.is_department_leader === 1).map(ld => (
                                <span 
                                  key={ld.department_id} 
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1 shadow-2xs"
                                  title={`Líder oficial de ${ld.department_name}`}
                                >
                                  <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-400" /> {ld.department_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            Voluntário
                          </span>
                        )}

                        {/* Definição Direta de Liderança pelo Administrador sem confirmação */}
                        {user?.is_general_admin && !m.is_child && (
                          <div className="relative mt-1">
                            <button
                              type="button"
                              onClick={() => setActiveLeaderMenuId(activeLeaderMenuId === m.id ? null : m.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold transition shadow-2xs cursor-pointer"
                              title="Definir liderança de departamento sem necessidade de confirmação"
                            >
                              <Crown className="w-3 h-3 text-amber-600" />
                              <span>{m.is_leader ? "Gerenciar Liderança" : "⭐ Definir Líder"}</span>
                              <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                            </button>

                            {activeLeaderMenuId === m.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-40" 
                                  onClick={() => setActiveLeaderMenuId(null)}
                                />
                                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                                  <div className="px-3 py-1 font-bold text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    Atribuição Direta (Sem Confirmação)
                                  </div>
                                  
                                  {/* Definir Líder Geral */}
                                  <button
                                    type="button"
                                    onClick={() => handleSetGeneralLeader(m.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-amber-50 text-amber-950 font-bold flex items-center justify-between transition cursor-pointer"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                                      ⭐ Líder Geral (Todos os Deptos)
                                    </span>
                                  </button>

                                  <div className="border-t border-slate-100 my-1" />
                                  <div className="px-3 py-1 font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                                    Definir por Departamento:
                                  </div>

                                  <div className="max-h-48 overflow-y-auto">
                                    {departments.map((dept) => {
                                      const isDeptLeader = m.departments.some(d => d.department_id === dept.id && d.is_department_leader === 1);
                                      return (
                                        <button
                                          type="button"
                                          key={dept.id}
                                          onClick={() => handleSetDeptLeader(m.id, dept.id)}
                                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center justify-between transition cursor-pointer"
                                        >
                                          <span className="flex items-center gap-1.5 truncate">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
                                            <span className={isDeptLeader ? "font-bold text-amber-900" : ""}>{dept.name}</span>
                                          </span>
                                          {isDeptLeader ? (
                                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                              <Check className="w-3 h-3 text-amber-600" /> Líder
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 hover:text-[#002F6C] font-semibold">
                                              + Definir
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {m.is_leader && (
                                    <>
                                      <div className="border-t border-slate-100 my-1" />
                                      <button
                                        type="button"
                                        onClick={() => handleDemoteLeader(m.id)}
                                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                        Mudar para Voluntário
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cargos */}
                    <td className="px-6 py-4">
                      {m.roles.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Sem cargos atribuídos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {m.roles.map((r) => (
                            <span
                              key={r.role_id}
                              className="text-xs px-2.5 py-1 rounded-md font-medium text-white shadow-xs"
                              style={{ backgroundColor: r.department_color || "#002F6C" }}
                              title={`${r.department_name}: ${r.role_name}`}
                            >
                              {r.role_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-6 py-4 text-right">
                      {isLeader ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditMemberModal(m)}
                            className="p-1.5 text-slate-500 hover:text-[#002F6C] hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="Editar membro"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                            title="Remover membro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 italic bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                            <Lock className="w-3 h-3 text-slate-400" /> Somente leitura
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                {editingMember ? "Editar Membro" : "Cadastrar Novo Membro"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Botão de Seleção: Criança / Dependente */}
              <div className={`p-4 rounded-xl border-2 transition ${formData.is_child ? "border-purple-300 bg-purple-50/60 shadow-sm" : "border-slate-200 bg-slate-50/50"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_child}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        const adultOptions = members.filter((m) => !m.is_child && m.id !== editingMember?.id);
                        const selectedAdult = adultOptions.find((m) => m.id === formData.parent_id) || adultOptions[0];
                        setFormData({
                          ...formData,
                          is_child: true,
                          is_leader: false,
                          leader_department_ids: [],
                          parent_id: selectedAdult ? selectedAdult.id : "",
                          phone: selectedAdult ? selectedAdult.phone : formData.phone,
                        });
                      } else {
                        setFormData({
                          ...formData,
                          is_child: false,
                          parent_id: "",
                        });
                      }
                    }}
                    className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                      <Baby className="w-4 h-4 text-purple-600" />
                      Membro Criança / Dependente (Sem telefone próprio)
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Marque esta opção caso o membro seja criança ou dependente e não possua celular próprio. O cadastro será vinculado ao número de WhatsApp do responsável cadastrado, mantendo o adulto como titular principal do contato.
                    </p>
                  </div>
                </label>

                {formData.is_child && (
                  <div className="mt-3 pt-3 border-t border-purple-200 space-y-2">
                    <label className="block text-xs font-bold text-purple-900 uppercase">
                      Selecione o Adulto Responsável *
                    </label>
                    <select
                      value={formData.parent_id}
                      onChange={(e) => {
                        const selectedAdult = members.find((m) => m.id === e.target.value);
                        setFormData({
                          ...formData,
                          parent_id: e.target.value,
                          phone: selectedAdult ? selectedAdult.phone : formData.phone,
                        });
                      }}
                      required={formData.is_child}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-purple-400 focus:border-purple-500"
                    >
                      <option value="" disabled>-- Selecione o membro adulto responsável já cadastrado --</option>
                      {members
                        .filter((m) => !m.is_child && m.id !== editingMember?.id)
                        .map((adult) => (
                          <option key={adult.id} value={adult.id}>
                            {adult.name} — Tel: {adult.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                          </option>
                        ))}
                    </select>
                    <div className="text-[11px] text-purple-900 bg-purple-100/70 p-2.5 rounded-lg flex items-start gap-2">
                      <span className="font-bold shrink-0">🔒 Vínculo Principal:</span>
                      <span>O número de WhatsApp cadastrado continuará associado prioritariamente ao responsável para fins de login e contatos.</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {formData.is_child ? "Nome da Criança *" : "Nome Completo *"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={formData.is_child ? "Ex: Pedrinho Silva" : "Ex: João da Silva"}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {formData.is_child ? "WhatsApp do Responsável *" : "WhatsApp (com DDD) *"}
                  </label>
                  <input
                    type="text"
                    required={!formData.is_child}
                    disabled={formData.is_child}
                    placeholder="Ex: (00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C] ${
                      formData.is_child
                        ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200 font-mono"
                        : "bg-white text-slate-900 placeholder:text-slate-400 border-slate-200"
                    }`}
                  />
                  <span className="text-[11px] text-slate-400">
                    {formData.is_child
                      ? "Número herdado automaticamente do adulto responsável selecionado."
                      : "Usado para lembretes e login simplificado."}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  placeholder="Ex: joao@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                />
              </div>

              <div className="space-y-3 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded text-[#002F6C] focus:ring-[#002F6C]"
                  />
                  <span className="font-medium">Membro Ativo para Escalas</span>
                </label>

                {formData.is_child ? (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
                    👶 Cargos de liderança e administração são restritos a membros adultos.
                  </div>
                ) : user?.is_general_admin ? (
                  <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-bold text-xs text-slate-900">
                            Atribuição de Liderança (Administrador Geral)
                          </span>
                          <p className="text-[11px] text-slate-500">
                            Defina este membro para líder de qualquer departamento sem necessidade de confirmação.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allDeptIds = departments.map((d) => d.id);
                          const areAllSelected =
                            allDeptIds.length > 0 &&
                            allDeptIds.every((id) => formData.leader_department_ids.includes(id));
                          if (areAllSelected) {
                            setFormData({
                              ...formData,
                              is_leader: false,
                              leader_department_ids: [],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              is_leader: true,
                              department_ids: Array.from(new Set([...formData.department_ids, ...allDeptIds])),
                              leader_department_ids: allDeptIds,
                            });
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 transition self-start sm:self-auto cursor-pointer"
                      >
                        {departments.length > 0 && departments.every((d) => formData.leader_department_ids.includes(d.id))
                          ? "Desmarcar Todos"
                          : "⭐ Tornar Líder Geral (Todos)"}
                      </button>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Departamentos que este membro lidera oficialmente:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {departments.map((dept) => {
                          const isDeptLeader = formData.leader_department_ids.includes(dept.id);
                          return (
                            <button
                              type="button"
                              key={dept.id}
                              onClick={() => toggleLeaderDeptSelection(dept.id)}
                              className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                isDeptLeader
                                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: isDeptLeader ? "#FFFFFF" : dept.color }}
                                />
                                <span className="truncate">{dept.name}</span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-1 ${
                                  isDeptLeader ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {isDeptLeader ? "⭐ Líder Oficial" : "Voluntário"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                    <label className="flex items-start gap-2.5 text-sm text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_leader}
                        onChange={(e) => setFormData({ ...formData, is_leader: e.target.checked })}
                        className="rounded text-[#002F6C] focus:ring-[#002F6C] mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-900">
                          Indicar este membro para Líder de Departamento
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                          O membro ficará como 'Indicação Pendente' e só se tornará líder após aprovação do Administrador.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Seleção de Cargos / Funções */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                  Cargos e Funções que este Membro pode desempenhar:
                </label>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-4 bg-slate-50/50">
                  {departments
                    .filter((dept) => user?.is_general_admin || (user?.led_department_ids || []).includes(dept.id))
                    .map((dept) => (
                    <div key={dept.id} className="bg-white p-3 rounded-lg border border-slate-200/80">
                      <div className="font-semibold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-2 mb-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: dept.color }}
                        />
                        {dept.name}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {dept.roles.map((role) => {
                          const isChecked = formData.role_ids.includes(role.id);
                          return (
                            <button
                              type="button"
                              key={role.id}
                              onClick={() => toggleRoleSelection(role.id, dept.id)}
                              className={`flex items-center justify-between p-2 rounded text-xs text-left border transition cursor-pointer ${
                                isChecked
                                  ? "bg-blue-50/80 border-blue-300 text-blue-900 font-medium"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span>{role.name}</span>
                              {isChecked && <Check className="w-3.5 h-3.5 text-[#002F6C]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Salvando..." : "Salvar Membro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Autenticação Rápida de Líder */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                setAuthModalOpen(false);
                setAuthError("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <Lock className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 text-center">
              Acesso Restrito: Liderança
            </h2>
            <p className="text-xs text-slate-600 text-center mt-1 mb-5 leading-relaxed">
              Somente um <strong>líder ou responsável</strong> logado pode cadastrar, editar ou remover membros da igreja.
            </p>

            <form onSubmit={handleLeaderAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp do Líder ou PIN de Acesso
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: (00) 00000-0000 ou PIN de acesso"
                  value={authInput}
                  onChange={(e) => setAuthInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002F6C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  placeholder="Digite sua senha de acesso"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002F6C]"
                />
              </div>

              {authError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                  {authError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalOpen(false);
                    setAuthError("");
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={authing || !authInput.trim()}
                  className="flex-1 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {authing ? "Validando..." : "Entrar como Líder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
