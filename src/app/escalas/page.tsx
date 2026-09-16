"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Calendar, 
  PlusCircle, 
  Filter, 
  Users, 
  Eye, 
  Trash2, 
  Clock, 
  UserCheck, 
  Sparkles,
  CalendarDays
} from "lucide-react";
import { getCurrentMonthYear, getNextMonthYear, formatMonthYear, isCurrentMonth, formatDateDDMMAAAA, sanitizeScheduleTitle } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";

interface Schedule {
  id: string;
  title: string;
  month_year: string;
  department_id: string;
  department_name: string;
  department_color: string;
  author_name: string;
  status: string;
  total_items: number;
  total_members_scheduled: number;
  vacant_items_count?: number;
  updated_at: string;
}

interface Department {
  id: string;
  name: string;
}

export default function EscalasGestaoPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState("all");

  const currentMonthYear = getCurrentMonthYear();
  const nextMonthYear = getNextMonthYear();
  // Padrão: Sempre focado no mês corrente de forma principal
  const [selectedMonth, setSelectedMonth] = useState<string>("current");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSchedules, resDepts] = await Promise.all([
        fetch("/api/schedules").then((r) => r.json()),
        fetch("/api/departments").then((r) => r.json()),
      ]);

      if (resSchedules.success) setSchedules(resSchedules.data);
      if (resDepts.success) setDepartments(resDepts.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string, authorName: string) => {
    if (!confirm(`Deseja realmente excluir a escala "${title}" elaborada por ${authorName}?`)) return;

    let authQuery = "";
    if (user?.phone) {
      authQuery = `?phone=${encodeURIComponent(user.phone)}`;
    } else {
      const code = prompt(`Apenas o responsável (${authorName}) ou a liderança pode excluir esta escala.\nDigite seu WhatsApp cadastrado ou PIN:`);
      if (!code) return;
      authQuery = `?pin=${encodeURIComponent(code)}&phone=${encodeURIComponent(code)}`;
    }

    try {
      const res = await fetch(`/api/schedules/${id}${authQuery}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Erro ao excluir escala.");
      }
    } catch (err) {
      alert("Erro ao excluir.");
    }
  };

  const filtered = schedules.filter((s) => {
    const matchesMonth =
      selectedMonth === "all"
        ? true
        : selectedMonth === "current"
        ? s.month_year === currentMonthYear
        : selectedMonth === "next"
        ? s.month_year === nextMonthYear
        : s.month_year === selectedMonth;

    const matchesDept = selectedDept === "all" || s.department_id === selectedDept;
    return matchesMonth && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner de Gestão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-[#002F6C]" />
            Gerenciamento de Escalas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Todas as escalas elaboradas pelos líderes dos departamentos da igreja.
          </p>
        </div>
        <Link
          href="/escalas/nova"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white font-medium rounded-lg shadow-sm transition text-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Elaborar Nova Escala
        </Link>
      </div>

      {/* Barra de Filtros: Mês Principal e Departamentos */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Seletor de Mês (Mês Corrente como Principal) */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold gap-1">
          <button
            onClick={() => setSelectedMonth("current")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              selectedMonth === "current"
                ? "bg-[#002F6C] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Mês Atual ({formatMonthYear(currentMonthYear).split(" de ")[0]})
          </button>
          <button
            onClick={() => setSelectedMonth("next")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              selectedMonth === "next"
                ? "bg-[#002F6C] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Próximo Mês
          </button>
          <button
            onClick={() => setSelectedMonth("all")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              selectedMonth === "all"
                ? "bg-[#002F6C] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            Todos os Meses
          </button>
        </div>

        {/* Filtro por departamento */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 uppercase">Departamento:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C]/20"
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

      {/* Grid de Escalas */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Carregando escalas...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">
            {selectedMonth === "current"
              ? `Nenhuma escala encontrada para ${formatMonthYear(currentMonthYear)}`
              : selectedMonth === "next"
              ? `Nenhuma escala encontrada para ${formatMonthYear(nextMonthYear)}`
              : "Nenhuma escala cadastrada"}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {selectedMonth === "current"
              ? "Cadastre a escala dos departamentos para o mês atual para manter toda a equipe alinhada."
              : "Tente alterar os filtros de mês ou departamento acima."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/escalas/nova"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#002F6C] hover:bg-[#002454] text-white text-xs font-bold rounded-lg transition"
            >
              <PlusCircle className="w-4 h-4" /> Elaborar Nova Escala
            </Link>
            {selectedMonth !== "all" && (
              <button
                onClick={() => setSelectedMonth("all")}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Ver Todos os Meses
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => {
            const isCurrent = isCurrentMonth(s.month_year);

            return (
              <div
                key={s.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col justify-between transition ${
                  isCurrent ? "border-[#002F6C]/40 ring-1 ring-[#002F6C]/15" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: s.department_color || "#002F6C" }}
                  />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: s.department_color || "#002F6C" }}
                      >
                        {s.department_name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {Boolean(s.vacant_items_count && s.vacant_items_count > 0) && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
                            ⚠️ {s.vacant_items_count} pendente{s.vacant_items_count! > 1 ? "s" : ""}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-slate-900" />
                            Mês Atual
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            s.status === "published"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {s.status === "published" ? "Publicada" : "Rascunho"}
                        </span>
                      </div>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 line-clamp-2">
                      {sanitizeScheduleTitle(s.title, s.month_year)}
                    </h2>

                    <div className="mt-4 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mês: <strong className="text-slate-700 capitalize">{formatMonthYear(s.month_year)}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Elaborada por: <strong className="text-slate-700">{s.author_name}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Última edição: {new Date(s.updated_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.total_members_scheduled} membros • {s.total_items} participações</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/escalas/${s.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#002F6C] hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> Visualizar e Exportar
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(s.id, s.title, s.author_name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                      title="Excluir escala"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}