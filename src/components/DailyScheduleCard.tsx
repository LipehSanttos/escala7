"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  ShieldCheck, 
  Radio, 
  HeartHandshake, 
  BookOpen, 
  Music, 
  Crown, 
  Users,
  Clock
} from "lucide-react";
import { IasdLogo } from "./IasdLogo";
import { toJpeg } from "html-to-image";

interface DailyItem {
  role_name: string;
  member_name: string;
  notes?: string;
}

interface DailyDepartment {
  id: string;
  name: string;
  color: string;
  icon: string;
  items: DailyItem[];
}

interface AvailableDate {
  date: string;
  service_type: string;
  count: number;
}

interface Props {
  churchName?: string;
  district?: string;
}

// Extrai "Dia XX - DiaDaSemana" (ex: "Dia 16 - Quarta-feira")
function formatDayAndWeekday(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const weekdays = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  const weekdayName = weekdays[d.getDay()];
  return `Dia ${day} - ${weekdayName}`;
}

// Extrai apenas o número do dia para o seletor (ex: 16)
function getDayNumber(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts.length === 3 ? parseInt(parts[2], 10) : dateStr;
}

// Mapeamento de ícones dinâmicos por departamento
function getDeptIcon(iconName: string) {
  switch ((iconName || "").toLowerCase()) {
    case "shieldcheck":
      return <ShieldCheck className="w-4 h-4 text-white" />;
    case "radio":
      return <Radio className="w-4 h-4 text-white" />;
    case "hearthandshake":
      return <HeartHandshake className="w-4 h-4 text-white" />;
    case "bookopen":
      return <BookOpen className="w-4 h-4 text-white" />;
    case "music":
      return <Music className="w-4 h-4 text-white" />;
    case "crown":
      return <Crown className="w-4 h-4 text-white" />;
    default:
      return <Users className="w-4 h-4 text-white" />;
  }
}

export function DailyScheduleCard({ churchName, district }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("");
  const [departments, setDepartments] = useState<DailyDepartment[]>([]);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDailyData(selectedDate);
  }, [selectedDate]);

  const fetchDailyData = async (dateStr?: string) => {
    try {
      setLoading(true);
      const url = dateStr ? `/api/schedules/daily?date=${dateStr}` : `/api/schedules/daily`;
      const res = await fetch(url, { headers: { "Bypass-Tunnel-Reminder": "true" } });
      const json = await res.json();

      if (json.success && json.data) {
        setDepartments(json.data.departments || []);
        setServiceType(json.data.service_type || "Culto");
        if (!selectedDate && json.data.date) {
          setSelectedDate(json.data.date);
        }
      }
      if (json.available_dates && Array.isArray(json.available_dates)) {
        setAvailableDates(json.available_dates);
      }
    } catch (err) {
      console.error("Erro ao carregar escala do dia:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentIndex = availableDates.findIndex((d) => d.date === selectedDate);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < availableDates.length - 1;

  const handlePreviousDate = () => {
    if (hasPrevious) {
      setSelectedDate(availableDates[currentIndex - 1].date);
    }
  };

  const handleNextDate = () => {
    if (hasNext) {
      setSelectedDate(availableDates[currentIndex + 1].date);
    }
  };

  const handleDownloadImage = async () => {
    const node = cardRef.current;
    if (!node) return;

    try {
      setDownloading(true);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const width = Math.round(node.offsetWidth);
      const height = Math.round(node.offsetHeight);

      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width,
        height,
        style: {
          margin: "0",
          boxShadow: "none",
        },
      });

      const link = document.createElement("a");
      const dayNum = getDayNumber(selectedDate);
      link.download = `escala_dia_${dayNum}_culto.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = () => {
    if (!departments || departments.length === 0) return;

    const dayText = formatDayAndWeekday(selectedDate);
    let text = `⛪ *${churchName || "Igreja Adventista do Sétimo Dia"}*\n`;
    text += `📅 *${dayText.toUpperCase()}*\n`;
    text += `📖 *${serviceType}*\n\n`;

    departments.forEach((dept) => {
      text += `🔹 *${dept.name.toUpperCase()}:*\n`;
      dept.items.forEach((item) => {
        text += `  • ${item.member_name} (${item.role_name})\n`;
      });
      text += `\n`;
    });

    text += `_"Tudo, porém, seja feito com decência e ordem." (1 Co 14:40)_\n`;
    text += `✨ Sistema escala7`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const dayWeekdayTitle = formatDayAndWeekday(selectedDate);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-6">
      {/* Cabeçalho da Seção com Controles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#002F6C]/10 text-[#002F6C] px-3 py-1 rounded-full text-xs font-bold mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Escalas do Dia</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Culto do Dia • Todos os Departamentos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consulte as equipes escaladas para cada dia de culto da igreja.
          </p>
        </div>

        {/* Seletor de Datas (Apenas o Dia + Culto) e Ações */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navegador de Dias: Mostra apenas o número do dia e o culto */}
          <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
            <button
              onClick={handlePreviousDate}
              disabled={!hasPrevious}
              title="Culto Anterior"
              className={`p-1.5 rounded-md transition ${
                hasPrevious ? "hover:bg-white text-slate-700 cursor-pointer shadow-2xs" : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-2 font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#002F6C]" />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs cursor-pointer focus:outline-none"
              >
                {availableDates.map((d) => (
                  <option key={d.date} value={d.date}>
                    Dia {getDayNumber(d.date)} • {d.service_type}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleNextDate}
              disabled={!hasNext}
              title="Próximo Culto"
              className={`p-1.5 rounded-md transition ${
                hasNext ? "hover:bg-white text-slate-700 cursor-pointer shadow-2xs" : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Botão de Gerar Imagem */}
          <button
            onClick={handleDownloadImage}
            disabled={downloading || departments.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#002F6C] hover:bg-[#002454] active:scale-98 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>{downloading ? "Gerando Imagem..." : "Gerar Imagem do Dia"}</span>
          </button>

          {/* Botão de Copiar Texto WhatsApp */}
          <button
            onClick={handleCopyText}
            disabled={departments.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
            title="Copiar texto formatado para o WhatsApp"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
          </button>
        </div>
      </div>

      {/* ÁREA DO CARD OFICIAL PARA VISUALIZAÇÃO E DOWNLOAD */}
      <div className="overflow-x-auto pb-2">
        <div
          ref={cardRef}
          className="min-w-[340px] max-w-3xl mx-auto bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-md flex flex-col"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {/* Topo Institucional do Card */}
          <div className="bg-gradient-to-r from-[#002F6C] via-[#003882] to-[#044B9E] text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
              <IasdLogo className="w-48 h-48 text-white" />
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center p-2 border border-white/20 backdrop-blur-xs">
                  <IasdLogo className="w-full h-full text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                    {churchName || "Igreja Adventista do Sétimo Dia"}
                  </h3>
                  <p className="text-xs text-blue-100/80">
                    {district || "Distrito Central"}
                  </p>
                </div>
              </div>

              {/* Badge do Culto */}
              <div className="self-start sm:self-auto bg-amber-400/20 text-amber-200 border border-amber-400/40 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{serviceType}</span>
              </div>
            </div>

            {/* Destaque Central: Apenas o Dia e o Dia da Semana (ex: Dia 16 - Quarta-feira) */}
            <div className="mt-5 pt-4 border-t border-white/15">
              <span className="text-xs uppercase tracking-widest text-amber-300/90 font-extrabold block">
                Escala do Culto
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-0.5">
                {dayWeekdayTitle || "Carregando..."}
              </h1>
            </div>
          </div>

          {/* Corpo do Card com Cada Departamento e Seus Escalados */}
          <div className="p-6 sm:p-8 bg-slate-50/60 space-y-5 flex-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Carregando escalas do dia...
              </div>
            ) : departments.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  Nenhum departamento escalado para este dia.
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Navegue pelas outras datas no seletor acima para ver as escalas disponíveis.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                  >
                    {/* Título do Departamento (ex: Sonoplastia, Diaconato, etc.) */}
                    <div
                      className="px-4 py-2.5 flex items-center justify-between text-white"
                      style={{ backgroundColor: dept.color || "#002F6C" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-white/20">
                          {getDeptIcon(dept.icon)}
                        </div>
                        <span className="font-extrabold text-sm tracking-wide">
                          {dept.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full">
                        {dept.items.length} {dept.items.length > 1 ? "escalados" : "escalado"}
                      </span>
                    </div>

                    {/* Lista dos Membros Escalados */}
                    <div className="p-3.5 divide-y divide-slate-100 space-y-2 flex-1">
                      {dept.items.map((item, idx) => (
                        <div key={idx} className={`${idx > 0 ? "pt-2" : ""} flex items-center justify-between gap-2`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: dept.color || "#002F6C" }}
                            />
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {item.member_name}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md shrink-0 border border-slate-200/80">
                            {item.role_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rodapé Oficial da Imagem */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
            <div className="flex items-center gap-2">
              <IasdLogo className="w-4 h-4 text-[#002F6C]" />
              <span className="font-medium text-slate-600">
                Sistema Oficial de Escalas • Igreja Adventista do Sétimo Dia
              </span>
            </div>
            <div className="text-[11px] text-slate-400 italic">
              "Tudo, porém, seja feito com decência e ordem." — 1 Co 14:40
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
