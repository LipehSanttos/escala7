"use client";

import React, { forwardRef } from "react";
import { IasdLogo } from "./IasdLogo";
import { Calendar, UserCheck, Clock, MapPin, Sparkles } from "lucide-react";
import { formatMonthYear, isCurrentMonth, formatDateDDMMAAAA, formatScheduleDay, formatScheduleDayWithWeekday, sanitizeScheduleTitle } from "@/lib/dateUtils";

export interface ScheduleItem {
  id: string;
  date: string;
  service_type: string;
  role_name: string;
  member_name: string;
  notes?: string;
}

export interface ScheduleData {
  id: string;
  title: string;
  month_year: string;
  department_name: string;
  department_color: string;
  author_name: string;
  updated_at: string;
  items: ScheduleItem[];
}

export interface Props {
  schedule: ScheduleData;
  churchName?: string;
  district?: string;
  mode?: "simplified" | "detailed";
  badgeTheme?: string;
}

// Estilo de cor fixo padrão Azul IASD oficial com marcadores dourados
const fixedIasdBadgeStyle = {
  className: "inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-white shadow-md font-bold",
  dotColor: "#FBBF24",
  textClassName: "font-black text-white text-[22px] tracking-tight leading-none",
  roleClassName: "text-[13px] text-white/90 font-bold pl-2.5 border-l-2 border-white/30",
  style: { backgroundColor: "#002F6C" },
};

// Extrair título simplificado para a imagem: "Escala de Sonoplastia - Setembro"
function getCleanImageTitle(schedule: ScheduleData) {
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  let monthName = "";
  if (schedule.month_year) {
    const parts = schedule.month_year.split("-");
    const mNum = parseInt(parts[1], 10);
    if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
      monthName = monthNames[mNum - 1];
    }
  }

  const isSonoplastia =
    (schedule.department_name || "").toLowerCase().includes("sono") ||
    (schedule.title || "").toLowerCase().includes("sono");
  const deptName = isSonoplastia ? "Sonoplastia e Mídia" : schedule.department_name;

  if (monthName) {
    return `Escala de ${deptName} - ${monthName}`;
  }
  return sanitizeScheduleTitle(schedule.title, schedule.month_year);
}

// Agrupar itens por data para modo detalhado
function groupItemsByDateDetailed(items: ScheduleItem[]) {
  const map = new Map<
    string,
    {
      date: string;
      services: { service_type: string; roles: { role_name: string; member_name: string }[] }[];
    }
  >();

  for (const it of items) {
    if (!map.has(it.date)) {
      map.set(it.date, { date: it.date, services: [] });
    }
    const dateGroup = map.get(it.date)!;
    let service = dateGroup.services.find((s) => s.service_type === it.service_type);
    if (!service) {
      service = { service_type: it.service_type, roles: [] };
      dateGroup.services.push(service);
    }
    service.roles.push({
      role_name: it.role_name,
      member_name: it.member_name,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Agrupar itens por data para modo simplificado (Data e Responsáveis)
function groupItemsByDateSimplified(items: ScheduleItem[]) {
  const map = new Map<
    string,
    {
      date: string;
      dayNumber: string;
      dayAndMonth: string;
      weekday: string;
      services: string[];
      members: { name: string; role?: string; isPending?: boolean }[];
    }
  >();

  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  for (const it of items) {
    if (!map.has(it.date)) {
      const parts = it.date.split("-");
      const dayNumber = parts[2] || "";
      const dayAndMonth = `Dia ${dayNumber}`;
      let weekday = "";
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        weekday = weekdays[d.getDay()];
      }

      map.set(it.date, {
        date: it.date,
        dayNumber,
        dayAndMonth,
        weekday,
        services: [],
        members: [],
      });
    }

    const group = map.get(it.date)!;
    if (it.service_type && !group.services.includes(it.service_type)) {
      group.services.push(it.service_type);
    }

    const isPending = !it.member_name || it.member_name.trim() === "";
    const memberDisplayName = isPending ? "A Definir" : it.member_name;

    const existing = group.members.find((m) => m.name === memberDisplayName);
    if (!existing) {
      group.members.push({
        name: memberDisplayName,
        role: it.role_name,
        isPending,
      });
    } else {
      if (existing.role && it.role_name && existing.role !== it.role_name) {
        existing.role += `, ${it.role_name}`;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return formatScheduleDayWithWeekday(dateStr);
}

export const ScheduleImageCard = forwardRef<HTMLDivElement, Props>(
  (
    {
      schedule,
      churchName = "Igreja Adventista do Sétimo Dia",
      district = "Distrito Central",
      mode = "simplified",
    },
    ref
  ) => {
    const primaryColor = schedule.department_color || "#002F6C";
    const detailedGroups = groupItemsByDateDetailed(schedule.items || []);
    const simplifiedGroups = groupItemsByDateSimplified(schedule.items || []);
    const badgeStyle = fixedIasdBadgeStyle;
    const imageTitle = getCleanImageTitle(schedule);

    return (
      <div className="w-full flex justify-center py-1">
        <div
          ref={ref}
          className="w-[800px] shrink-0 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 text-slate-900"
          style={{
            margin: "0px",
            width: "800px",
            minWidth: "800px",
            maxWidth: "800px",
            boxSizing: "border-box",
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          {/* Banner Superior com Título Limpo e Fontes Maiores */}
          <div
            className="px-8 py-6 text-white relative overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
            {/* Fundo decorativo sutil */}
            <div className="absolute -right-8 -bottom-10 opacity-10 pointer-events-none">
              <IasdLogo className="w-64 h-64 text-white" />
            </div>

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/95">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>
                    {churchName} • {district}
                  </span>
                </div>

                {/* Título Oficial: Ex: Escala de Sonoplastia - Setembro */}
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-xs">
                  {imageTitle}
                </h1>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-block bg-white/20 backdrop-blur-xs text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                    {schedule.department_name}
                  </span>
                  <span className="inline-block bg-black/25 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize">
                    Mês: {formatMonthYear(schedule.month_year)}
                  </span>
                  {isCurrentMonth(schedule.month_year) && (
                    <span className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs">
                      <Sparkles className="w-3 h-3 text-slate-950" />
                      Mês Vigente
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 bg-white/10 p-3 rounded-2xl border border-white/20 shadow-inner">
                <IasdLogo className="h-16 w-16 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Corpo da Escala com Fontes Significativamente Aumentadas para Pessoas com Dificuldade de Enxergar */}
          {mode === "simplified" ? (
            /* MODO SIMPLIFICADO: Linhas de Data e Nome dos Responsáveis */
            <div className="p-5 bg-slate-50/60">
              {simplifiedGroups.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-base font-medium">
                  Nenhuma escala cadastrada para exibição.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="bg-slate-100/90 px-7 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4.5 h-4.5 text-slate-600" />
                      Data e Dia do Culto
                    </span>
                    <span>Pessoal Responsável</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {simplifiedGroups.map((group, idx) => (
                      <div
                        key={group.date}
                        className={`flex items-center justify-between px-7 py-3.5 gap-4 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                        }`}
                      >
                        {/* Data e Dia da Semana - Fontes Grandes de Alta Visibilidade */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div
                            className="flex items-center justify-center w-14 h-14 rounded-2xl font-black text-white text-[24px] shadow-sm shrink-0"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {group.dayNumber}
                          </div>
                          <div>
                            <div className="font-black text-slate-950 text-[24px] flex items-center gap-2.5 leading-none">
                              <span className="tracking-tight">{group.dayAndMonth}</span>
                              <span className="text-[13px] font-black px-2.5 py-1 rounded-lg text-slate-900 bg-slate-200 border border-slate-300 uppercase tracking-wider">
                                {group.weekday}
                              </span>
                            </div>
                            {group.services.length > 0 && (
                              <div className="text-[13px] text-slate-600 font-bold mt-1.5">
                                {group.services.join(" • ")}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nomes dos Responsáveis com Badges Grandes, Destacados e de Fácil Leitura */}
                        <div className="flex flex-wrap items-center gap-2.5 justify-end">
                          {group.members.map((m: any, mIdx: number) =>
                            m.isPending ? (
                              <div
                                key={mIdx}
                                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-amber-100 border-2 border-amber-400 text-amber-950 shadow-sm font-black"
                              >
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-amber-600 animate-pulse" />
                                <span className="text-[18px] font-black text-amber-950 uppercase tracking-tight leading-none">
                                  ⚠️ A Definir (Pendente)
                                </span>
                              </div>
                            ) : (
                              <div
                                key={mIdx}
                                className={badgeStyle.className}
                                style={badgeStyle.style}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0"
                                  style={{ backgroundColor: badgeStyle.dotColor }}
                                />
                                <span className={badgeStyle.textClassName}>
                                  {m.name}
                                </span>
                                {m.role && m.role !== "Som e Mídia" && (
                                  <span className={badgeStyle.roleClassName}>
                                    {m.role}
                                  </span>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* MODO DETALHADO */
            <div className="p-5 space-y-4 bg-slate-50/50">
              {detailedGroups.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Nenhuma escala cadastrada para exibição.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {detailedGroups.map((group) => (
                    <div
                      key={group.date}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between"
                    >
                      <div>
                        {/* Cabeçalho do Dia */}
                        <div
                          className="flex items-center justify-between pb-2.5 mb-3 border-b-2"
                          style={{ borderColor: primaryColor }}
                        >
                          <div className="flex items-center gap-2 font-black text-slate-950 text-[18px]">
                            <Calendar className="w-4.5 h-4.5" style={{ color: primaryColor }} />
                            <span>{formatDate(group.date)}</span>
                          </div>
                        </div>

                        {/* Cultos e Cargos */}
                        <div className="space-y-3">
                          {group.services.map((srv, sIndex) => (
                            <div key={sIndex} className="space-y-2">
                              <div className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">
                                {srv.service_type}
                              </div>
                              <div className="space-y-2">
                                {srv.roles.map((r, rIndex) => (
                                  <div
                                    key={rIndex}
                                    className="flex items-center justify-between text-sm py-2 px-3.5 rounded-xl bg-slate-50 border border-slate-200"
                                  >
                                    <span className="text-slate-800 font-bold text-[14px]">
                                      {r.role_name}:
                                    </span>
                                    {r.member_name ? (
                                      <span
                                        className="font-black text-[18px] px-4 py-1.5 rounded-xl shadow-xs ml-2"
                                        style={badgeStyle.style}
                                      >
                                        <span className={badgeStyle.textClassName}>
                                          {r.member_name}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="font-bold text-[14px] px-3 py-1.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 italic ml-2">
                                        ⚠️ Pendente / A Definir
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rodapé Oficial da Arte */}
          <div className="px-8 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 text-sm text-slate-700">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4.5 h-4.5 text-slate-500" />
                <span>
                  Responsável: <strong className="text-slate-900 font-bold">{schedule.author_name}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-slate-500" />
                <span>
                  Atualizado em:{" "}
                  <strong className="text-slate-900 font-bold">
                    {new Date(schedule.updated_at).toLocaleDateString("pt-BR")}
                  </strong>
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 italic">
              "Tudo, porém, seja feito com decência e ordem." — 1 Coríntios 14:40
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ScheduleImageCard.displayName = "ScheduleImageCard";