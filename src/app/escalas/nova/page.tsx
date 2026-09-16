"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  Clock, 
  User, 
  Info,
  CalendarPlus,
  ArrowLeft,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Phone
} from "lucide-react";
import Link from "next/link";
import { getCurrentMonthYear, formatMonthShort, getStandardScheduleTitle, formatDateDDMMAAAA, formatDateWithWeekday, formatScheduleDayWithWeekday } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";

interface Department {
  id: string;
  name: string;
  color: string;
  roles: { id: string; name: string }[];
}

interface Member {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  is_leader: boolean;
  roles: { role_id: string; role_name: string }[];
}

interface ScheduleRow {
  temp_id: string;
  date: string;
  service_type: string;
  role_id: string;
  member_id: string;
  notes: string;
  conflictWarning?: string | null;
}

export default function NovaEscalaPage() {
  const router = useRouter();
  const { user, loading: authLoading, login, logout } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick login state when logged out
  const [loginInput, setLoginInput] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Form Header
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("published");

  // Schedule Items
  const [items, setItems] = useState<ScheduleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const res = await login(loginInput, loginPassword);
    setLoggingIn(false);
    if (!res.success) {
      setLoginError(res.error || "Erro ao conectar. Verifique o número, senha ou PIN.");
    }
  };

  useEffect(() => {
    if (user?.name) {
      setAuthorName(user.name);
    }
  }, [user]);

  const availableDepartments = React.useMemo(() => {
    if (!user) return [];
    if (user.is_general_admin) return departments;
    return departments.filter((d) => (user.led_department_ids || []).includes(d.id));
  }, [departments, user]);

  useEffect(() => {
    // Current month/year default
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const defaultMonthYear = `${year}-${month}`;
    setMonthYear(defaultMonthYear);

    Promise.all([
      fetch("/api/departments").then((r) => r.json()),
      fetch("/api/members").then((r) => r.json()),
    ]).then(([dData, mData]) => {
      if (dData.success) {
        setDepartments(dData.data);
      }
      if (mData.success) {
        setMembers(mData.data);
        if (!authorName && user?.name) {
          setAuthorName(user.name);
        }
      }
      setLoading(false);
    });
  }, []);

  // Ajusta departamento selecionado e título padrão quando os departamentos permitidos forem carregados
  useEffect(() => {
    if (availableDepartments.length > 0) {
      const currentValid = availableDepartments.some((d) => d.id === departmentId);
      if (!currentValid) {
        const first = availableDepartments[0];
        setDepartmentId(first.id);
        setTitle(getStandardScheduleTitle(first.name, monthYear));
      } else {
        const current = availableDepartments.find((d) => d.id === departmentId);
        if (current && (!title || title.startsWith("Escala de "))) {
          setTitle(getStandardScheduleTitle(current.name, monthYear));
        }
      }
    }
  }, [availableDepartments, monthYear]);

  const currentDept = departments.find((d) => d.id === departmentId);

  const handleDeptChange = (newDeptId: string) => {
    setDepartmentId(newDeptId);
    const dept = departments.find((d) => d.id === newDeptId);
    if (dept) {
      setTitle(getStandardScheduleTitle(dept.name, monthYear));
    }
  };

  const handleMonthYearChange = (newMonthYear: string) => {
    setMonthYear(newMonthYear);
    if (currentDept) {
      setTitle(getStandardScheduleTitle(currentDept.name, newMonthYear));
    }
  };

  // Adiciona linha individual
  const addRow = () => {
    const defaultRole = currentDept?.roles[0]?.id || "";
    const newRow: ScheduleRow = {
      temp_id: "row_" + Math.random().toString(36).slice(2, 9),
      date: new Date().toISOString().split("T")[0],
      service_type: "Culto de Sábado (Manhã)",
      role_id: defaultRole,
      member_id: "",
      notes: "",
      conflictWarning: null,
    };
    setItems([...items, newRow]);
  };

  // Preenchimento automático do mês com Sábados, Quartas e Domingos em ordem cronológica
  const generateMonthCultos = () => {
    if (!monthYear || !currentDept) return;
    const [yearStr, monthStr] = monthYear.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const generated: ScheduleRow[] = [];

    const isDiaconato =
      currentDept.id === "diaconato" ||
      currentDept.name.toLowerCase().includes("diaconato");

    // Identificar funções específicas de Diácono e Diaconisa para o Diaconato
    let diacRole = currentDept.roles.find(
      (r) => r.id === "diac_escala" || r.name.toLowerCase().includes("diácono")
    );
    let diaconisaRole = currentDept.roles.find(
      (r) => r.id === "diaconisa_escala" || r.name.toLowerCase().includes("diaconisa")
    );

    if (!diacRole && currentDept.roles.length > 0) diacRole = currentDept.roles[0];
    if (!diaconisaRole && currentDept.roles.length > 1) diaconisaRole = currentDept.roles[1];

    // Membros elegíveis
    const activeMembers = members.filter((m) => m.is_active);
    const diaconosList = activeMembers.filter((m) =>
      m.roles?.some((r: any) => r.role_id === diacRole?.id || r.role_name?.toLowerCase().includes("diácono"))
    );
    const diaconisasList = activeMembers.filter((m) =>
      m.roles?.some((r: any) => r.role_id === diaconisaRole?.id || r.role_name?.toLowerCase().includes("diaconisa"))
    );

    // Membros do departamento atual (para os outros departamentos)
    const deptMembers = activeMembers.filter((m) =>
      m.roles?.some((r: any) => currentDept.roles.some((cr) => cr.id === r.role_id))
    );

    let diacIdx = 0;
    let diaconisaIdx = 0;
    let deptMemberIdx = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dayOfWeek = dateObj.getDay(); // 0 = Dom, 3 = Qua, 6 = Sáb
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Apenas dias de culto da igreja: Sábado (6), Quarta (3) e Domingo (0)
      if (dayOfWeek !== 6 && dayOfWeek !== 3 && dayOfWeek !== 0) {
        continue;
      }

      let serviceType = "Culto de Sábado (Manhã)";
      if (dayOfWeek === 3) serviceType = "Culto de Quarta (Oração)";
      else if (dayOfWeek === 0) serviceType = "Culto de Domingo (Evangelismo)";

      if (isDiaconato) {
        // Regra Especial de Diaconato: exatamente 2 pessoas para o mesmo dia (1 diácono e 1 diaconisa)
        const chosenDiac = diaconosList.length > 0 ? diaconosList[diacIdx % diaconosList.length].id : "";
        const chosenDiaconisa = diaconisasList.length > 0 ? diaconisasList[diaconisaIdx % diaconisasList.length].id : "";

        if (diaconosList.length > 0) diacIdx++;
        if (diaconisasList.length > 0) diaconisaIdx++;

        // 1. Diácono
        generated.push({
          temp_id: "row_" + Math.random().toString(36).slice(2, 9),
          date: dateStr,
          service_type: serviceType,
          role_id: diacRole ? diacRole.id : currentDept.roles[0]?.id || "",
          member_id: chosenDiac,
          notes: "",
        });

        // 2. Diaconisa
        generated.push({
          temp_id: "row_" + Math.random().toString(36).slice(2, 9),
          date: dateStr,
          service_type: serviceType,
          role_id: diaconisaRole ? diaconisaRole.id : currentDept.roles[1]?.id || currentDept.roles[0]?.id || "",
          member_id: chosenDiaconisa,
          notes: "",
        });
      } else {
        // Outros departamentos (Sonoplastia e Mídia, etc.)
        if (dayOfWeek === 6) {
          // Sábado: adiciona uma linha para cada papel do departamento
          for (const role of currentDept.roles) {
            const roleMembers = deptMembers.filter((m) =>
              m.roles?.some((r: any) => r.role_id === role.id)
            );
            const pool = roleMembers.length > 0 ? roleMembers : deptMembers;
            const chosenMember = pool.length > 0 ? pool[deptMemberIdx % pool.length].id : "";
            if (pool.length > 0) deptMemberIdx++;

            generated.push({
              temp_id: "row_" + Math.random().toString(36).slice(2, 9),
              date: dateStr,
              service_type: serviceType,
              role_id: role.id,
              member_id: chosenMember,
              notes: "",
            });
          }
        } else {
          // Quarta e Domingo: adiciona a função principal
          const defaultRole = currentDept.roles[0]?.id || "";
          const chosenMember = deptMembers.length > 0 ? deptMembers[deptMemberIdx % deptMembers.length].id : "";
          if (deptMembers.length > 0) deptMemberIdx++;

          generated.push({
            temp_id: "row_" + Math.random().toString(36).slice(2, 9),
            date: dateStr,
            service_type: serviceType,
            role_id: defaultRole,
            member_id: chosenMember,
            notes: "",
          });
        }
      }
    }

    setItems(generated);
  };

  const updateRow = async (temp_id: string, field: keyof ScheduleRow, value: any) => {
    const updated = items.map((it) => (it.temp_id === temp_id ? { ...it, [field]: value } : it));
    setItems(updated);

    // Se alterou member_id ou date, checar conflito
    const row = updated.find((it) => it.temp_id === temp_id);
    if (row && row.member_id && row.date) {
      checkConflictForRow(row, updated);
    }
  };

  const removeRow = (temp_id: string) => {
    setItems(items.filter((it) => it.temp_id !== temp_id));
  };

  // Checagem de conflitos em tempo real
  const checkConflictForRow = async (row: ScheduleRow, allRows: ScheduleRow[]) => {
    // 1. Conflito interno (mesmo membro na mesma data em outra linha desta escala)
    const internalConflict = allRows.some(
      (it) => it.temp_id !== row.temp_id && it.date === row.date && it.member_id === row.member_id
    );

    if (internalConflict) {
      setItems((prev) =>
        prev.map((it) =>
          it.temp_id === row.temp_id
            ? { ...it, conflictWarning: "Atenção: Este membro já está alocado em outra função nesta mesma data!" }
            : it
        )
      );
      return;
    }

    // 2. Conflito externo (outras escalas no banco)
    try {
      const res = await fetch("/api/schedules/check-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: row.member_id,
          date: row.date,
        }),
      });
      const data = await res.json();
      if (data.hasConflict) {
        const c = data.conflicts[0];
        setItems((prev) =>
          prev.map((it) =>
            it.temp_id === row.temp_id
              ? {
                  ...it,
                  conflictWarning: `⚠️ Conflito Externo: Já escalado em ${c.department_name} (${c.role_name}) nesta data!`,
                }
              : it
          )
        );
      } else {
        setItems((prev) =>
          prev.map((it) =>
            it.temp_id === row.temp_id ? { ...it, conflictWarning: null } : it
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError("");

    if (!departmentId || !title.trim() || !monthYear || !authorName.trim()) {
      setGlobalError("Preencha todos os dados principais do cabeçalho da escala.");
      return;
    }

    if (items.length === 0) {
      setGlobalError("Adicione pelo menos uma alocação de culto na escala.");
      return;
    }

    // Checar se há conflito não resolvido
    const hasActiveConflicts = items.some((it) => it.conflictWarning);
    if (hasActiveConflicts) {
      setGlobalError("Existem conflitos de membros com mais de um cargo na mesma data. Por favor, resolva os alertas antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: departmentId,
          title,
          month_year: monthYear,
          author_name: authorName,
          status,
          notes,
          user_id: user?.id,
          user_phone: user?.phone,
          items: items.map((it) => ({
            date: it.date,
            service_type: it.service_type,
            role_id: it.role_id,
            member_id: it.member_id,
            notes: it.notes,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/escalas/${data.data.id}`);
      } else {
        setGlobalError(data.error || "Erro ao salvar escala.");
      }
    } catch (err: any) {
      setGlobalError(err.message || "Erro na conexão.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-16 text-center text-slate-500">Verificando permissões e carregando dados...</div>;
  }

  // 1. Usuário deslogado: Bloqueio obrigatório com formulário de login rápido
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-2xs">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-2">
          Acesso Restrito: Elaboração de Escalas
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          Um usuário deslogado <strong>não pode elaborar escalas</strong>. Somente um usuário <strong>líder ou responsável</strong> pode criar escalas se estiver logado.
        </p>

        <form onSubmit={handleQuickLogin} className="space-y-4 text-left bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              WhatsApp do Líder ou PIN Administrativo
            </label>
            <input
              type="text"
              required
              placeholder="Ex: (00) 00000-0000 ou PIN de acesso"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
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
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002F6C]"
            />
          </div>
          {loginError && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            disabled={loggingIn || !loginInput.trim()}
            className="w-full py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white font-bold rounded-lg text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loggingIn ? "Autenticando..." : "Entrar como Líder / Responsável"}
          </button>
        </form>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a página inicial
        </Link>
      </div>
    );
  }

  // 2. Usuário logado mas sem perfil de liderança
  if (!user.is_leader) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200 shadow-2xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 mb-2">
          Permissão Insuficiente
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          Você está conectado como voluntário (<strong>{user.name}</strong>). A elaboração de novas escalas é permitida exclusivamente aos líderes ou responsáveis por departamento.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2 bg-[#002F6C] hover:bg-[#002454] text-white font-bold rounded-lg text-xs transition shadow-xs"
          >
            Ver Escalas Públicas
          </Link>
          <button
            onClick={logout}
            className="w-full sm:w-auto px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
          >
            Entrar com Outra Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Selo de Líder Autorizado */}
      <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950 font-semibold shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Conectado como Responsável: <strong>{user.name}</strong> ({user.phone}) — {user.is_general_admin ? "Líder Geral (Todos os Departamentos)" : `Líder: ${user.led_department_names?.join(", ") || "Departamento Designado"}`}
          </span>
        </div>
        <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
          🛡️ Autorizado a Elaborar Escala
        </span>
      </div>

      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Escalas
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Cabeçalho da Escala */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-[#002F6C]" />
              Elaborar Nova Escala
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Monte a escala com validação automática anti-conflito em tempo real.
            </p>
          </div>

          {globalError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Departamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Departamento *
              </label>
              {availableDepartments.length === 0 ? (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  Você não lidera nenhum departamento ativo.
                </div>
              ) : (
                <select
                  value={departmentId}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                >
                  {availableDepartments.map((d) => (
                    <option key={d.id} value={d.id} className="text-slate-900 bg-white">
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Mês/Ano */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Mês de Referência *
                </label>
                {monthYear === getCurrentMonthYear() && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Mês Atual
                  </span>
                )}
              </div>
              <input
                type="month"
                required
                value={monthYear}
                onChange={(e) => handleMonthYearChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
              />
            </div>

            {/* Responsável pela Elaboração */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Responsável pela Escala *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Silva (Líder)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
              />
              <span className="text-[10px] text-slate-400">Aparecerá visível no cabeçalho</span>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Status da Escala
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
              >
                <option value="published" className="text-slate-900 bg-white">Publicada (Visível ao público)</option>
                <option value="draft" className="text-slate-900 bg-white">Rascunho (Apenas líderes)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Título da Escala *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
            />
          </div>
        </div>

        {/* Linhas da Escala */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Alocações de Membros nos Cultos</h2>
              <p className="text-xs text-slate-500">
                O sistema confere se os membros selecionados têm choque de horário ou função.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generateMonthCultos}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Gera automaticamente cultos de Quarta, Sábado e Domingo para o mês selecionado"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-blue-600" /> Preencher Mês Automático (Sáb, Qua e Dom)
              </button>

              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Culto
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">Nenhum culto inserido na escala ainda.</p>
              <p className="text-xs text-slate-400 mt-1">
                Clique em "Preencher Mês Automático" ou "Adicionar Culto" para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.temp_id}
                  className={`p-4 rounded-xl border transition ${
                    item.conflictWarning
                      ? "bg-red-50/70 border-red-300 ring-1 ring-red-300"
                      : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
                    {/* Data */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Data do Culto
                      </label>
                      <input
                        type="date"
                        required
                        value={item.date}
                        onChange={(e) => updateRow(item.temp_id, "date", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#002F6C]"
                      />
                      {item.date && (
                        <div className="text-[10px] font-bold text-[#002F6C] mt-0.5">
                          {formatScheduleDayWithWeekday(item.date)}
                        </div>
                      )}
                    </div>

                    {/* Culto / Ocasião */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Culto / Programa
                      </label>
                      <select
                        value={item.service_type}
                        onChange={(e) => updateRow(item.temp_id, "service_type", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#002F6C]"
                      >
                        <option value="Culto de Sábado (Manhã)" className="text-slate-900 bg-white">Culto de Sábado (Manhã)</option>
                        <option value="Escola Sabatina (Sábado)" className="text-slate-900 bg-white">Escola Sabatina (Sábado)</option>
                        <option value="Culto Jovem / JA (Sábado)" className="text-slate-900 bg-white">Culto Jovem / JA (Sábado)</option>
                        <option value="Culto de Quarta (Oração)" className="text-slate-900 bg-white">Culto de Quarta (Oração)</option>
                        <option value="Culto de Domingo" className="text-slate-900 bg-white">Culto de Domingo</option>
                        <option value="Programa Especial / Santa Ceia" className="text-slate-900 bg-white">Programa Especial / Santa Ceia</option>
                      </select>
                    </div>

                    {/* Função / Cargo */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Função / Cargo
                      </label>
                      <select
                        value={item.role_id}
                        onChange={(e) => updateRow(item.temp_id, "role_id", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#002F6C] font-medium"
                      >
                        {currentDept?.roles.map((r) => (
                          <option key={r.id} value={r.id} className="text-slate-900 bg-white">
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Membro Escalado */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                        Membro Escalado
                      </label>
                      <select
                        value={item.member_id}
                        required
                        onChange={(e) => updateRow(item.temp_id, "member_id", e.target.value)}
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white focus:outline-none font-semibold ${
                          item.conflictWarning ? "border-red-400 text-red-700 bg-red-50" : "border-slate-300 text-slate-900"
                        }`}
                      >
                        <option value="" className="text-slate-500 bg-white">-- Selecione o Membro --</option>
                        {members
                          .filter((m) => m.is_active)
                          .map((m) => (
                            <option key={m.id} value={m.id} className="text-slate-900 bg-white">
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Ação Remover */}
                    <div className="flex items-end justify-end pt-4 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => removeRow(item.temp_id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remover linha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Alerta de Conflito em Destaque */}
                  {item.conflictWarning && (
                    <div className="mt-2.5 p-2 bg-red-100/90 border border-red-300 rounded-md text-xs font-semibold text-red-800 flex items-center gap-2 animate-pulse">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{item.conflictWarning}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rodapé do Formulário com Metadados */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Responsável pela elaboração: <strong className="text-slate-700">{authorName || "Não informado"}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Data de edição: <strong className="text-slate-700">Hoje</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando Escala..." : "Salvar e Publicar Escala"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}