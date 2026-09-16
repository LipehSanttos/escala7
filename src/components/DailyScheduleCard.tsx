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
  Clock,
  MapPin
} from "lucide-react";
import { IasdLogo } from "./IasdLogo";
import { toJpeg } from "html-to-image";
import { formatDateWithWeekday, formatDateDDMMAAAA } from "@/lib/dateUtils";

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

  // Carrega as escalas da data selecionada
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

  // Navegação entre as datas com escala
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

  // Gerar e Baixar a Imagem Oficial do Dia (WhatsApp/Instagram)
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
      link.download = `escala_culto_${selectedDate.replace(/-/g, "_")}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
    } finally {
      setDownloading(false);
    }
  };

  // Copiar o texto do dia para colar no WhatsApp
  const handleCopyText = () => {
    if (!departments || departments.length === 0) return;

    const formattedDate = formatDateWithWeekday(selectedDate);
    let text = `⛪ *${churchName || "Igreja Adventista do Sétimo Dia"}*\n`;
    text += `📅 *ESCALA DO DIA: ${formattedDate.toUpperCase()}*\n`;
    text += `📖 *${serviceType}*\n\n`;

    departments.forEach((dept) => {
      text += `🔹 *${dept.name.toUpperCase()}*\n`;
      dept.items.forEach((item) => {
        text += ` • ${item.member_name} (${item.role_name})\n`;
      });
      text += `\n`;
    });

    text += `_"Tudo, porém, seja feito com decência e ordem." (1 Co 14:40)_\n`;
    text += `✨ Sistema escala7`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Compartilhar via Web Share API se disponível no dispositivo móvel
  const handleShareMobile = async () => {
    if (navigator.share) {
      const formattedDate = formatDateWithWeekday(selectedDate);
      let text = `Escala de Culto - ${formattedDate} (${serviceType})\n\n`;
      departments.forEach((dept) => {
        text += `${dept.name}:\n`;
        dept.items.forEach((item) => {
          text += ` - ${item.member_name} (${item.role_name})\n`;
        });
        text += `\n`;
      });

      try {
        await navigator.share({
          title: `Escala do Dia - ${churchName || "IASD"}`,
          text: text,
          url: window.location.href,
        });
      } catch (e) {
        // Usuário cancelou
      }
    } else {
      handleCopyText();
    }
  };

  const formattedDateTitle = selectedDate ? formatDateWithWeekday(selectedDate) : "Carregando data...";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-6">
      {/* Cabeçalho da Seção com Controles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#002F6C]/10 text-[#002F6C] px-3 py-1 rounded-full text-xs font-bold mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Escala Consolidada do Dia</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Culto do Dia • Todos os Departamentos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Visão unificada das equipes escaladas para o culto de cada data.
          </p>
        </div>

        {/* Seletor de Datas e Ações */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navegador de Dias com Escala */}
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
                    {formatDateDDMMAAAA(d.date)} • {d.service_type.split("(")[0].trim()}
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

          {/* Botão de Baixar Imagem */}
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

      {/* ÁREA DO CARD OFICIAL PARA VISUALIZAÇÃO E DOWNLOAD (RENDERIZÁVEL COMO IMAGEM) */}
      <div className="overflow-x-auto pb-2">
        <div
          ref={cardRef}
          className="min-w-[340px] max-w-3xl mx-auto bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-md flex flex-col"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {/* Topo Institucional do Card com Gradiente Azul Oficial IASD */}
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
                    {district || "Distrito Central"} • Culto Eclesiástico
                  </p>
                </div>
              </div>

              {/* Selo do Culto */}
              <div className="self-start sm:self-auto bg-amber-400/20 text-amber-200 border border-amber-400/40 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{serviceType}</span>
              </div>
            </div>

            {/* Destaque Central da Data */}
            <div className="mt-5 pt-4 border-t border-white/15">
              <span className="text-xs uppercase tracking-widest text-amber-300/90 font-extrabold block">
                Escala do Culto
              </span>
              <h1 className="text-xl sm:text-3xl font-black text-white capitalize tracking-tight mt-0.5">
                {formattedDateTitle}
              </h1>
            </div>
          </div>

          {/* Corpo do Card com os Departamentos Agrupados */}
          <div className="p-6 sm:p-8 bg-slate-50/50 space-y-6 flex-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Carregando escalas do dia...
              </div>
            ) : departments.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  Nenhum departamento escalado para esta data.
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Selecione outra data nos botões acima ou consulte as escalas completas do mês vigente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-xs transition"
                  >
                    {/* Cabeçalho do Departamento */}
                    <div
                      className="px-4 py-2.5 flex items-center justify-between text-white"
                      style={{ backgroundColor: dept.color || "#002F6C" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-white/20">
                          {getDeptIcon(dept.icon)}
                        </div>
                        <span className="font-extrabold text-xs uppercase tracking-wide">
                          {dept.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full">
                        {dept.items.length} escalado{dept.items.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Lista de Membros e Funções */}
                    <div className="p-3.5 divide-y divide-slate-100 space-y-2">
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
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0 border border-slate-200/60">
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
