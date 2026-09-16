"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  CalendarDays, 
  Calendar, 
  Users, 
  Layers, 
  Eye, 
  PlusCircle, 
  Clock, 
  UserCheck, 
  Search,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { IasdLogo } from "@/components/IasdLogo";
import { DailyScheduleCard } from "@/components/DailyScheduleCard";
import { getCurrentMonthYear, formatMonthYear, isCurrentMonth, formatDateDDMMAAAA, sanitizeScheduleTitle } from "@/lib/dateUtils";
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

interface ChurchInfo {
  name: string;
  district: string;
  city: string;
  state: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const currentMonthYear = getCurrentMonthYear();

  useEffect(() => {
    Promise.all([
      fetch("/api/schedules?status=published", {
        headers: { "Bypass-Tunnel-Reminder": "true" },
      }).then((r) => r.json()),
      fetch("/api/church", {
        headers: { "Bypass-Tunnel-Reminder": "true" },
      }).then((r) => r.json()),
    ])
      .then(([sData, cData]) => {
        if (sData.success && Array.isArray(sData.data)) setSchedules(sData.data);
        if (cData.success) setChurch(cData.data);
      })
      .catch((err) => console.error("Erro ao carregar dados:", err))
      .finally(() => setLoading(false));
  }, []);

  // Exibe escalas do mês vigente se houver; se o dispositivo estiver em outro mês ou não houver escalas para o mês exato, exibe todas as escalas publicadas disponíveis
  const hasCurrentMonth = schedules.some((s) => s.month_year === currentMonthYear);

  const filtered = schedules.filter((s) => {
    const matchesMonth = hasCurrentMonth ? s.month_year === currentMonthYear : true;
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.department_name.toLowerCase().includes(search.toLowerCase()) ||
      s.author_name.toLowerCase().includes(search.toLowerCase());

    return matchesMonth && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Banner de Boas-Vindas Institucional */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#002F6C] via-[#003882] to-[#044B9E] text-white p-6 sm:p-10 shadow-lg border border-[#002454]">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <IasdLogo className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-amber-300 border border-white/10">
            <IasdLogo className="w-4 h-4 text-amber-400" />
            <span>Escalas Eclesiásticas • IASD</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {church?.name || "Igreja Adventista do Sétimo Dia"}
          </h1>

          <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
            Consulte as escalas dos cultos e ministérios da igreja. Verifique suas datas de atuação, compartilhe imagens oficiais para grupos e mantenha os serviços alinhados com ordem e pontualidade.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
            {user?.is_leader ? (
              <>
                <Link
                  href="/escalas/nova"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-lg shadow-sm transition"
                >
                  <PlusCircle className="w-4 h-4" /> Elaborar Escala
                </Link>
                <Link
                  href="/membros"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition border border-white/20"
                >
                  <Users className="w-4 h-4" /> Cadastro de Membros
                </Link>
              </>
            ) : user ? (
              <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-lg border border-white/15 text-blue-100">
                <CalendarDays className="w-4 h-4 text-amber-300" />
                <span>Conectado como <strong className="text-white">{user.name}</strong> (Voluntário) — Visualização pública de escalas</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-lg border border-white/15 text-blue-100">
                <CalendarDays className="w-4 h-4 text-amber-300" />
                <span>Visualização pública oficial — Faça login para gerenciar ou solicitar trocas</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campo com as Escalas do Dia / Próximo Culto (com botão para gerar imagem) */}
      <DailyScheduleCard 
        churchName={church?.name} 
        district={church?.district} 
      />

      {/* Cabeçalho da Lista: Escalas do Mês Vigente e Busca Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Mês Vigente
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 capitalize">
              Escalas de {formatMonthYear(currentMonthYear)}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Equipes escaladas para as atividades de {formatMonthYear(currentMonthYear)}.
          </p>
        </div>

        {/* Busca Rápida */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por departamento ou líder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002F6C]/20"
          />
        </div>
      </div>

      {/* Grid de Escalas Vigentes */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-sm">Carregando escalas da igreja...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <CalendarDays className="w-14 h-14 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">
            Nenhuma escala publicada para {formatMonthYear(currentMonthYear)} ainda
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            As escalas do mês vigente aparecerão aqui assim que forem publicadas pela liderança.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/escalas/nova"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" /> Elaborar Escala
            </Link>
            <Link
              href="/escalas"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition cursor-pointer"
            >
              Ver Todas as Escalas
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => {
            const isCurrent = isCurrentMonth(s.month_year);

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition group ${
                  isCurrent ? "border-[#002F6C]/40 ring-1 ring-[#002F6C]/15" : "border-slate-200"
                }`}
              >
                <div>
                  {/* Faixa Temática do Departamento */}
                  <div
                    className="h-3 w-full"
                    style={{ backgroundColor: s.department_color || "#002F6C" }}
                  />

                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded text-white"
                        style={{ backgroundColor: s.department_color || "#002F6C" }}
                      >
                        {s.department_name}
                      </span>

                      {/* Destaque Mês Vigente vs Outro Mês */}
                      <div className="flex items-center gap-1.5">
                        {Boolean(s.vacant_items_count && s.vacant_items_count > 0) && (
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1">
                            ⚠️ {s.vacant_items_count} pendente{s.vacant_items_count! > 1 ? "s" : ""}
                          </span>
                        )}
                        {isCurrent ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 flex items-center gap-1 shadow-2xs">
                            <Sparkles className="w-3 h-3 text-slate-900" />
                            Mês Vigente
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {formatMonthYear(s.month_year)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-[#002F6C] transition line-clamp-2">
                      {sanitizeScheduleTitle(s.title, s.month_year)}
                    </h2>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>
                          Período: <strong className="text-slate-700 capitalize">{formatMonthYear(s.month_year)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-slate-400" />
                        <span>
                          Elaborado por: <strong className="text-slate-700">{s.author_name}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>
                          <strong>{s.total_members_scheduled}</strong> membros escalados •{" "}
                          <strong>{s.total_items}</strong> participações
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>
                          Última edição em {new Date(s.updated_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ação de Consulta */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/escalas/${s.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar Escala (Datas e Responsáveis)
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}