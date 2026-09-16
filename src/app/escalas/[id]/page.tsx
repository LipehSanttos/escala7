"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  Calendar, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ArrowLeft, 
  Clock, 
  UserCheck, 
  MessageSquare,
  AlertCircle,
  UserX,
  Repeat,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Bell,
  Layers,
  Sparkles,
  Phone,
  Palette,
  UserPlus,
  X,
  AlertTriangle,
  Lock
} from "lucide-react";
import { ScheduleImageCard } from "@/components/ScheduleImageCard";
import { toJpeg, toPng } from "html-to-image";
import { useAuth } from "@/contexts/AuthContext";
import { formatMonthYear, isCurrentMonth, formatDateDDMMAAAA, formatDateWithWeekday, sanitizeScheduleTitle, formatScheduleDay, formatScheduleDayWithWeekday, formatScheduleDayShortWeekday } from "@/lib/dateUtils";

export default function EscalaDetalhesPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();

  const cardRef = useRef<HTMLDivElement>(null);

  const [schedule, setSchedule] = useState<any>(null);
  const [church, setChurch] = useState<any>(null);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"simplified" | "detailed">("simplified");

  // Modais de Membro
  const [absenceModalItem, setAbsenceModalItem] = useState<any>(null);
  const [absenceReason, setAbsenceReason] = useState("");

  const [swapModalItem, setSwapModalItem] = useState<any>(null);
  const [targetMemberId, setTargetMemberId] = useState("");
  const [swapReason, setSwapReason] = useState("");

  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState("");

  // Modal de Definição de Substituto / Nova Pessoa pelo Líder
  const [replaceModalItem, setReplaceModalItem] = useState<{
    scheduleItemId: string;
    requestId?: string;
    date: string;
    roleName: string;
    serviceType?: string;
    currentMemberName: string;
  } | null>(null);
  const [replacementMemberId, setReplacementMemberId] = useState("");
  const [replaceNotes, setReplaceNotes] = useState("");
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadAllData();
  }, [id]);

  const loadAllData = async () => {
    try {
      const headers = { "Bypass-Tunnel-Reminder": "true" };
      const [sData, cData, mData, rData] = await Promise.all([
        fetch(`/api/schedules/${id}`, { headers }).then((r) => r.json()),
        fetch("/api/church", { headers }).then((r) => r.json()),
        fetch("/api/members", { headers }).then((r) => r.json()),
        fetch(`/api/schedules/requests?schedule_id=${id}&status=all`, { headers }).then((r) => r.json()),
      ]);

      if (sData.success) setSchedule(sData.data);
      if (cData.success) setChurch(cData.data);
      if (mData.success) setAllMembers(mData.data);
      if (rData.success) setRequests(rData.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Download como imagem (JPG ou PNG) sem cortes ou margens indesejadas
  const handleDownload = async (format: "jpeg" | "png" = "jpeg") => {
    const node = cardRef.current;
    if (!node) return;
    setDownloading(true);

    try {
      // 1. Zera temporariamente qualquer scroll horizontal do container pai
      const parent = node.parentElement;
      const originalScrollLeft = parent ? parent.scrollLeft : 0;
      if (parent) parent.scrollLeft = 0;

      // 2. Aguarda micro-render para estabilização de fontes e dimensões
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 3. Medidas precisas do card (sem margens externas)
      const width = Math.round(node.offsetWidth);
      const height = Math.round(node.offsetHeight);

      const renderOptions = {
        quality: format === "jpeg" ? 0.95 : undefined,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: width,
        height: height,
        style: {
          margin: "0",
          marginLeft: "0",
          marginRight: "0",
          marginTop: "0",
          marginBottom: "0",
          padding: "0",
          transform: "none",
          left: "0",
          top: "0",
          position: "static",
          width: `${width}px`,
          maxWidth: "none",
          boxSizing: "border-box",
          boxShadow: "none",
        },
      };

      const dataUrl =
        format === "jpeg"
          ? await toJpeg(node, renderOptions)
          : await toPng(node, renderOptions);

      // 4. Restaura o scroll do pai se existia
      if (parent && originalScrollLeft > 0) {
        parent.scrollLeft = originalScrollLeft;
      }

      const link = document.createElement("a");
      const safeTitle = (schedule?.title || "escala")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
      const modeSuffix = viewMode === "simplified" ? "_simplificada" : "_detalhada";
      link.download = `${safeTitle}${modeSuffix}.${format === "jpeg" ? "jpg" : "png"}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
      alert("Não foi possível gerar a imagem. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  };

  // Gerador de Texto Formatado para WhatsApp
  const generateWhatsAppMessage = () => {
    if (!schedule) return "";

    const cName = church?.name || "Igreja Adventista do Sétimo Dia";
    let text = `🏛️ *${cName.toUpperCase()}*\n`;
    text += `📋 *${sanitizeScheduleTitle(schedule.title, schedule.month_year)}*\n`;
    text += `📍 Departamento: *${schedule.department_name}*\n`;
    text += `👤 Responsável: ${schedule.author_name}\n`;
    text += `═══════════════════════\n\n`;

    const map = new Map<string, any[]>();
    for (const it of schedule.items || []) {
      if (!map.has(it.date)) map.set(it.date, []);
      map.get(it.date)!.push(it);
    }

    if (viewMode === "simplified") {
      text += `📅 *DIAS E RESPONSÁVEIS NO MÊS:*\n\n`;

      for (const [date, items] of map.entries()) {
        const formattedDate = formatScheduleDayShortWeekday(date);

        // Nomes únicos com suas funções se houver mais de uma
        const memberList = items
          .map((i: any) =>
            i.member_name
              ? `${i.member_name}${i.role_name && i.role_name !== "Som e Mídia" ? ` (${i.role_name})` : ""}`
              : "⚠️ *VAGO / PENDENTE*"
          )
          .join(", ");
        text += `🗓️ *${formattedDate}*: ${memberList}\n`;
      }
    } else {
      for (const [date, items] of map.entries()) {
        const formattedDate = formatScheduleDayWithWeekday(date);
        text += `🗓️ *${formattedDate}*\n`;

        for (const item of items) {
          text += ` • *${item.role_name}*: ${item.member_name || "⚠️ VAGO / PENDENTE"}\n`;
        }
        text += `\n`;
      }
    }

    text += `\n═══════════════════════\n`;
    text += `⚠️ _Caso não possa comparecer, sinalize com antecedência no link abaixo:_\n`;
    text += `🔗 Acesse a escala online: ${window.location.href}`;

    return text;
  };

  const handleCopyText = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const text = generateWhatsAppMessage();
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  // Submissão de Ausência
  const submitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceModalItem || !user) return;

    setRequestSubmitting(true);
    try {
      const res = await fetch("/api/schedules/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_item_id: absenceModalItem.id,
          member_id: user.id,
          request_type: "absence",
          reason: absenceReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAbsenceModalItem(null);
        setAbsenceReason("");
        setActionSuccessMessage("Aviso de ausência enviado ao líder com sucesso!");
        loadAllData();
        setTimeout(() => setActionSuccessMessage(""), 4000);
      } else {
        alert(data.error || "Erro ao registrar ausência.");
      }
    } catch (e) {
      alert("Erro na requisição.");
    } finally {
      setRequestSubmitting(false);
    }
  };

  // Submissão de Troca
  const submitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapModalItem || !user || !targetMemberId) return;

    setRequestSubmitting(true);
    try {
      const res = await fetch("/api/schedules/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_item_id: swapModalItem.id,
          member_id: user.id,
          request_type: "swap",
          target_member_id: targetMemberId,
          reason: swapReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSwapModalItem(null);
        setTargetMemberId("");
        setSwapReason("");
        setActionSuccessMessage("Pedido de troca enviado para aprovação do líder!");
        loadAllData();
        setTimeout(() => setActionSuccessMessage(""), 4000);
      } else {
        alert(data.error || "Erro ao registrar troca.");
      }
    } catch (e) {
      alert("Erro na requisição.");
    } finally {
      setRequestSubmitting(false);
    }
  };

  // Aprovação / Recusa pelo Líder
  const handleReviewRequest = async (requestId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch("/api/schedules/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          action,
          reviewed_by: user?.name || "Responsável",
          user_id: user?.id,
          user_phone: user?.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadAllData();
      } else {
        alert(data.error || "Erro ao processar solicitação.");
      }
    } catch (e) {
      alert("Erro de conexão.");
    }
  };

  // Definição de substituto pelo Líder / Responsável
  const handleConfirmReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceModalItem || !replacementMemberId) return;

    setReplaceSubmitting(true);
    try {
      // 1. Checar duplicidade interna na mesma escala e mesma data
      const intraDuplicate = (schedule?.items || []).some(
        (it: any) =>
          it.id !== replaceModalItem.scheduleItemId &&
          it.date === replaceModalItem.date &&
          it.member_id === replacementMemberId
      );

      if (intraDuplicate) {
        alert("Não é permitida duplicidade: Este membro já está alocado nesta mesma data nesta escala.");
        setReplaceSubmitting(false);
        return;
      }

      // 2. Checar conflito cruzado em outros departamentos nesta mesma data
      const confRes = await fetch("/api/schedules/check-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: replacementMemberId,
          date: replaceModalItem.date,
          exclude_item_id: replaceModalItem.scheduleItemId,
          exclude_schedule_id: id,
        }),
      });
      const confData = await confRes.json();
      if (confData.hasConflict) {
        const c = confData.conflicts[0];
        alert(`Conflito de escala: O voluntário já está escalado(a) no departamento "${c.department_name}" (${c.role_name}) nesta data! Não é permitida duplicidade de membro no mesmo dia.`);
        setReplaceSubmitting(false);
        return;
      }

      if (replaceModalItem.requestId) {
        // Resolução de pedido de ausência/troca pendente
        const res = await fetch("/api/schedules/requests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: replaceModalItem.requestId,
            action: "approve",
            reviewed_by: user?.name || "Responsável",
            replacement_member_id: replacementMemberId,
            user_id: user?.id,
            user_phone: user?.phone,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setActionSuccessMessage("Nova pessoa definida e escala atualizada com sucesso!");
          setReplaceModalItem(null);
          setReplacementMemberId("");
          setReplaceNotes("");
          loadAllData();
          setTimeout(() => setActionSuccessMessage(""), 4000);
        } else {
          alert(data.error || "Erro ao definir substituto.");
        }
      } else {
        // Substituição direta pelo líder na escala
        const res = await fetch(`/api/schedules/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schedule_item_id: replaceModalItem.scheduleItemId,
            new_member_id: replacementMemberId,
            notes: replaceNotes || undefined,
            user_id: user?.id,
            user_phone: user?.phone,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setActionSuccessMessage(data.message || "Nova pessoa definida na escala com sucesso!");
          setReplaceModalItem(null);
          setReplacementMemberId("");
          setReplaceNotes("");
          loadAllData();
          setTimeout(() => setActionSuccessMessage(""), 4000);
        } else {
          alert(data.error || "Erro ao atualizar membro na escala.");
        }
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setReplaceSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Carregando escala...</div>;
  }

  if (!schedule) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-800">Escala não encontrada</h2>
        <Link href="/" className="text-sm text-[#002F6C] font-semibold mt-4 inline-block">
          Voltar para a página inicial
        </Link>
      </div>
    );
  }

  const isScheduleLeader = Boolean(
    user && (
      user.is_general_admin ||
      (schedule?.department_id && (user.led_department_ids || []).includes(schedule.department_id)) ||
      (schedule?.author_name && user.name.trim().toLowerCase() === schedule.author_name.trim().toLowerCase())
    )
  );

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const vacantItems = (schedule?.items || []).filter((it: any) => !it.member_id || !it.member_name);

  // Agrupamento simplificado por data para a tabela interativa
  const simplifiedRows: {
    date: string;
    dayNumber: string;
    dayAndMonth: string;
    weekday: string;
    services: string[];
    items: any[];
  }[] = [];

  const weekdaysList = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const dateMap = new Map<string, any[]>();
  for (const it of schedule.items || []) {
    if (!dateMap.has(it.date)) dateMap.set(it.date, []);
    dateMap.get(it.date)!.push(it);
  }

  for (const [date, items] of Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const parts = date.split("-");
    const dayNumber = parts[2] || "";
    const dayAndMonth = `Dia ${dayNumber}`;
    let weekday = "";
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      weekday = weekdaysList[d.getDay()];
    }

    const services = Array.from(new Set(items.map((i) => i.service_type).filter(Boolean)));

    simplifiedRows.push({
      date,
      dayNumber,
      dayAndMonth,
      weekday,
      services,
      items,
    });
  }

  // Agrupamento detalhado por data para a visão detalhada
  const detailedGroups: {
    date: string;
    services: { service_type: string; roles: { id: string; role_name: string; member_name: string; member_phone?: string }[] }[];
  }[] = [];

  const detailedMap = new Map<string, { date: string; services: { service_type: string; roles: any[] }[] }>();
  for (const it of schedule.items || []) {
    if (!detailedMap.has(it.date)) {
      detailedMap.set(it.date, { date: it.date, services: [] });
    }
    const dGroup = detailedMap.get(it.date)!;
    let srv = dGroup.services.find(s => s.service_type === it.service_type);
    if (!srv) {
      srv = { service_type: it.service_type, roles: [] };
      dGroup.services.push(srv);
    }
    srv.roles.push({
      id: it.id,
      role_name: it.role_name,
      member_name: it.member_name,
      member_phone: it.member_phone,
    });
  }
  for (const grp of Array.from(detailedMap.values()).sort((a, b) => a.date.localeCompare(b.date))) {
    detailedGroups.push(grp);
  }

  // Estilo fixo padrão Azul IASD oficial com alto contraste
  const getTableBadgeStyle = (_item: any) => {
    return {
      wrapperClass: "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-white shadow-xs font-bold",
      dotColor: "#FBBF24",
      textClass: "font-black text-white text-sm sm:text-base tracking-wide",
      roleClass: "text-[11px] text-white/90 font-semibold pl-1.5 border-l border-white/25",
      style: { backgroundColor: "#002F6C" },
    };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Feedback de Ação */}
      {actionSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Aviso de Modo Público com Contatos Protegidos */}
      {!user && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <span className="font-bold text-slate-800">Modo de Visualização Pública:</span> Por privacidade e proteção dos membros, os contatos diretos (WhatsApp e telefones) estão ocultos. Para visualizar contatos ou solicitar trocas de escala, faça login no sistema.
            </div>
          </div>
        </div>
      )}

      {/* Barra Superior de Navegação, Alternância de Visualização e Ações */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>

          {isCurrentMonth(schedule?.month_year) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              Mês Vigente ({formatMonthYear(schedule?.month_year)})
            </span>
          )}

          {/* Alternador de Visão e Botão de Download Lado a Lado */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("simplified")}
                className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "simplified"
                    ? "bg-[#002F6C] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Visão Simplificada
              </button>
              <button
                type="button"
                onClick={() => setViewMode("detailed")}
                className={`px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "detailed"
                    ? "bg-[#002F6C] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-4 h-4" />
                Visão Detalhada
              </button>
            </div>

            {/* Botão de Download Imediatamente Próximo */}
            <button
              type="button"
              onClick={() => handleDownload("jpeg")}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              title={viewMode === "simplified" ? "Baixar imagem simplificada para WhatsApp" : "Baixar imagem completa e técnica"}
            >
              <Download className="w-4 h-4" />
              {downloading ? "Gerando Imagem..." : (viewMode === "simplified" ? "Baixar Imagem Simplificada" : "Baixar Imagem Completa")}
            </button>
          </div>
        </div>

        {/* Botões de Apoio: PNG, Copiar e WhatsApp */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownload("png")}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-[#002F6C] border border-blue-200 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-50"
            title="Baixar imagem em formato PNG"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>

          <button
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            {copied ? "Texto Copiado!" : "Copiar p/ WhatsApp"}
          </button>

          <button
            onClick={handleSendWhatsApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Enviar no WhatsApp
          </button>
        </div>
      </div>

      {/* Painel do Responsável: Notificações de Trocas, Ausências e Dias Vagos */}
      {isScheduleLeader && (
        <div className="space-y-4">
          {pendingRequests.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-3">
                <Bell className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Central do Responsável: Existem solicitações de troca ou ausência pendentes!</span>
              </div>

              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-white p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {req.request_type === "absence" ? (
                          <span className="text-red-700 flex items-center gap-1.5 font-extrabold">
                            <UserX className="w-4 h-4 text-red-600" /> Sinalização de Ausência / Desistência: {req.member_name}
                          </span>
                        ) : (
                          <span className="text-blue-800 flex items-center gap-1.5 font-bold">
                            <Repeat className="w-4 h-4 text-blue-600" /> Solicitação de Troca: {req.member_name} ➔ {req.target_member_name}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 mt-1">
                        Função: <strong>{req.role_name}</strong> • Culto: <strong>{formatScheduleDayWithWeekday(req.date)}</strong>
                      </div>
                      {req.reason && (
                        <div className="text-slate-500 italic mt-0.5">Motivo: "{req.reason}"</div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {req.request_type === "absence" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(req.id, "approve")}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                            title="Aprova a saída do voluntário da escala, deixando o dia vago/pendente até você indicar outra pessoa"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprovar Ausência (Deixar Vago)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplaceModalItem({
                                scheduleItemId: req.schedule_item_id,
                                requestId: req.id,
                                date: req.date,
                                roleName: req.role_name,
                                serviceType: req.service_type,
                                currentMemberName: req.member_name,
                              });
                              setReplacementMemberId("");
                              setReplaceNotes("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                            title="Definir imediatamente quem substituirá este membro"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Definir Substituto Imediato
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(req.id, "reject")}
                            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg font-semibold transition cursor-pointer"
                          >
                            Recusar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(req.id, "approve")}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Confirmar Troca ({req.target_member_name})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplaceModalItem({
                                scheduleItemId: req.schedule_item_id,
                                requestId: req.id,
                                date: req.date,
                                roleName: req.role_name,
                                serviceType: req.service_type,
                                currentMemberName: req.member_name,
                              });
                              setReplacementMemberId("");
                              setReplaceNotes("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold cursor-pointer transition"
                            title="Escolher outro membro substituto"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Outro Substituto
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(req.id, "reject")}
                            className="px-2.5 py-2 border border-red-200 hover:bg-red-50 text-red-700 rounded-lg font-semibold cursor-pointer transition"
                          >
                            Recusar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de Dias Vagos / Pendentes aguardando nova pessoa */}
          {vacantItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-orange-950 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                <span>
                  Dias Pendentes na Escala: Há {vacantItems.length} data(s) vaga(s) aguardando nova pessoa!
                </span>
              </div>
              <p className="text-xs text-orange-900 leading-relaxed">
                As datas abaixo estão sem voluntário escalado. O membro anterior foi retirado e o dia ficará pendente até que você defina uma nova pessoa.
              </p>

              <div className="space-y-2">
                {vacantItems.map((vItem: any) => {
                  const formattedDate = formatScheduleDayWithWeekday(vItem.date);
                  return (
                    <div
                      key={vItem.id}
                      className="bg-white p-3.5 rounded-xl border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-950 font-bold text-xs">
                            {formattedDate}
                          </span>
                          <span>{vItem.service_type}</span>
                        </div>
                        <div className="text-slate-600 mt-1">
                          Função: <strong className="text-slate-900">{vItem.role_name}</strong>
                          {vItem.notes && (
                            <span className="text-amber-800 font-medium ml-2">• {vItem.notes}</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setReplaceModalItem({
                            scheduleItemId: vItem.id,
                            date: vItem.date,
                            roleName: vItem.role_name,
                            serviceType: vItem.service_type,
                            currentMemberName: "Vago / Pendente",
                          });
                          setReplacementMemberId("");
                          setReplaceNotes("");
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg font-bold shadow-xs transition cursor-pointer shrink-0 self-start sm:self-auto"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Definir Nova Pessoa
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingRequests.length === 0 && vacantItems.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Conectado como Responsável: <strong>{user?.name}</strong>. Todas as datas estão preenchidas e confirmadas sem pendências.
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full font-bold shrink-0">
                100% Preenchida
              </span>
            </div>
          )}
        </div>
      )}

      {/* Painel Interativo para Membro Escalado */}
      {user && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Suas Atribuições Nesta Escala ({user.name}):
          </div>
          {schedule.items.filter((it: any) => it.member_id === user.id).length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Você não possui alocações nesta escala específica.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {schedule.items
                .filter((it: any) => it.member_id === user.id)
                .map((it: any) => (
                  <div
                    key={it.id}
                    className="p-3 bg-blue-50/60 rounded-lg border border-blue-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{it.role_name}</div>
                      <div className="text-slate-500">
                        {formatScheduleDayWithWeekday(it.date)} • {it.service_type}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAbsenceModalItem(it)}
                        className="p-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 rounded-md shadow-xs transition cursor-pointer"
                        title="Não poderei comparecer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSwapModalItem(it)}
                        className="p-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 rounded-md shadow-xs transition cursor-pointer"
                        title="Solicitar troca de escala"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* VISÃO SIMPLIFICADA INTERATIVA: Tabela de Datas e Pessoas Responsáveis */}
      {viewMode === "simplified" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#002F6C]" />
                Escala Simplificada: Datas e Responsáveis ({formatMonthYear(schedule.month_year)})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Relação direta dos dias com as respectivas pessoas escaladas no mês.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-[#002F6C] rounded-full border border-blue-200 shrink-0">
              {simplifiedRows.length} dias escalados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-40">Dia do Culto</th>
                  <th className="py-3 px-4 w-52">Culto / Ocasião</th>
                  <th className="py-3 px-4">Pessoal Responsável</th>
                  <th className="py-3 px-4 text-right w-36">
                    {user ? (
                      "Contato Direto"
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold" title="Faça login para contatar">
                        <Lock className="w-3 h-3 text-slate-400" /> Contato
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {simplifiedRows.map((row, idx) => (
                  <tr
                    key={row.date}
                    className={`hover:bg-blue-50/30 transition ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg font-black text-white flex items-center justify-center text-sm shrink-0 shadow-2xs"
                          style={{ backgroundColor: schedule.department_color || "#002F6C" }}
                        >
                          {row.dayNumber}
                        </div>
                        <div>
                          <div className="font-black text-slate-950 text-sm sm:text-base leading-tight">{row.dayAndMonth}</div>
                          <div className="text-xs font-bold text-slate-500 uppercase">{row.weekday}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {row.services.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.services.map((srv, srvIdx) => (
                            <span
                              key={srvIdx}
                              className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium"
                            >
                              {srv}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Culto Regular</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.items.map((item: any, itIdx: number) => {
                          const isVacant = !item.member_id || !item.member_name;
                          const badge = getTableBadgeStyle(item);
                          return (
                            <div key={itIdx} className="flex items-center gap-2 flex-wrap">
                              {isVacant ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 shadow-2xs font-bold text-xs">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>⚠️ Vago / Pendente</span>
                                  {item.role_name && item.role_name !== "Som e Mídia" && (
                                    <span className="text-[10px] text-amber-800 font-bold pl-1.5 border-l border-amber-300">
                                      {item.role_name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className={badge.wrapperClass}
                                  style={badge.style}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: badge.dotColor }}
                                  />
                                  <span className={badge.textClass}>{item.member_name}</span>
                                  {item.role_name && item.role_name !== "Som e Mídia" && (
                                    <span className={badge.roleClass}>
                                      {item.role_name}
                                    </span>
                                  )}
                                </div>
                              )}

                              {isScheduleLeader && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplaceModalItem({
                                      scheduleItemId: item.id,
                                      date: item.date,
                                      roleName: item.role_name,
                                      serviceType: item.service_type,
                                      currentMemberName: item.member_name || "Vago / Pendente",
                                    });
                                    setReplacementMemberId("");
                                    setReplaceNotes("");
                                  }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition shadow-xs cursor-pointer ${
                                    isVacant
                                      ? "bg-[#002F6C] hover:bg-[#002454] text-white"
                                      : "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold"
                                  }`}
                                  title={isVacant ? "Definir novo voluntário para esta data" : `Substituir ${item.member_name}`}
                                >
                                  <UserPlus className={`w-3 h-3 ${isVacant ? "text-amber-300" : "text-amber-700"}`} />
                                  <span>{isVacant ? "Definir Pessoa" : "Substituir"}</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {!user ? (
                        <div className="flex items-center justify-end">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 text-slate-400 text-[11px] font-medium border border-slate-200/60"
                            title="Contatos diretos e links de WhatsApp visíveis apenas para membros conectados"
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Protegido</span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {row.items.map((item: any, itIdx: number) => {
                            if (!item.member_id || !item.member_name) {
                              return (
                                <span key={itIdx} className="text-amber-700 font-bold text-[11px] italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  ⚠️ Vago
                                </span>
                              );
                            }
                            if (!item.member_phone) return null;
                            const cleanPhone = item.member_phone.replace(/\D/g, "");
                            const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                            const parts = item.date.split("-");
                            const dayNum = parts[2] || item.date;
                            const msg = `Olá, ${item.member_name}! Confirmando sua escala no dia ${dayNum} para ${schedule.department_name}. Deus abençoe!`;
                            const href = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;

                            return (
                              <a
                                key={itIdx}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-medium transition"
                                title={`Enviar WhatsApp para ${item.member_name}`}
                              >
                                <Phone className="w-3 h-3" />
                                <span className="hidden sm:inline">{item.member_name.split(" ")[0]}</span>
                              </a>
                            );
                          })}
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

      {/* VISÃO DETALHADA INTERATIVA: Funções Técnicas, Cultos e Membros */}
      {viewMode === "detailed" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#002F6C]" />
                Escala Detalhada: Cultos e Funções ({formatMonthYear(schedule.month_year)})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibição completa com a distribuição de cada voluntário em suas respectivas funções técnicas por culto.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-[#002F6C] rounded-full border border-blue-200 shrink-0">
              {detailedGroups.length} cultos no mês
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detailedGroups.map((group) => (
              <div
                key={group.date}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between hover:border-[#002F6C]/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-[#002F6C]">
                    <div className="flex items-center gap-2 font-black text-slate-950 text-sm sm:text-base">
                      <Calendar className="w-4 h-4 text-[#002F6C]" />
                      <span>{formatScheduleDayWithWeekday(group.date)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.services.map((srv, sIndex) => (
                      <div key={sIndex} className="space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {srv.service_type}
                        </div>
                        <div className="space-y-2">
                          {srv.roles.map((r, rIndex) => (
                            <div
                              key={rIndex}
                              className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 gap-2"
                            >
                              <span className="text-slate-800 font-bold shrink-0">
                                {r.role_name}:
                              </span>
                              {r.member_name ? (
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  <span className="font-bold text-white bg-[#002F6C] px-3 py-1 rounded-lg text-xs shadow-2xs">
                                    {r.member_name}
                                  </span>

                                  {user && r.member_phone ? (
                                    <a
                                      href={`https://wa.me/${r.member_phone.replace(/\D/g, "").startsWith("55") ? r.member_phone.replace(/\D/g, "") : "55" + r.member_phone.replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                                      title={`WhatsApp de ${r.member_name}`}
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                  ) : !user ? (
                                    <span
                                      className="p-1 rounded bg-slate-100 text-slate-400 border border-slate-200 text-[10px]"
                                      title="Contato protegido: Faça login para contatar"
                                    >
                                      <Lock className="w-3 h-3" />
                                    </span>
                                  ) : null}

                                  {isScheduleLeader && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplaceModalItem({
                                          scheduleItemId: r.id,
                                          date: group.date,
                                          roleName: r.role_name,
                                          serviceType: srv.service_type,
                                          currentMemberName: r.member_name,
                                        });
                                        setReplacementMemberId("");
                                        setReplaceNotes("");
                                      }}
                                      className="text-[10px] text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded font-bold cursor-pointer transition"
                                      title={`Substituir ${r.member_name}`}
                                    >
                                      Substituir
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  <span className="font-bold text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg text-xs italic">
                                    ⚠️ Pendente / A Definir
                                  </span>
                                  {isScheduleLeader && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplaceModalItem({
                                          scheduleItemId: r.id,
                                          date: group.date,
                                          roleName: r.role_name,
                                          serviceType: srv.service_type,
                                          currentMemberName: "Vago / Pendente",
                                        });
                                        setReplacementMemberId("");
                                        setReplaceNotes("");
                                      }}
                                      className="text-[10px] text-white bg-[#002F6C] hover:bg-[#002454] px-2 py-1 rounded font-bold cursor-pointer transition"
                                    >
                                      Definir
                                    </button>
                                  )}
                                </div>
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
        </div>
      )}

      {/* Elemento oculto para geração da imagem JPG/PNG via html-to-image (sem ocupar espaço ou poluir a tela) */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: "-9999px",
          width: "800px",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -100,
        }}
        aria-hidden="true"
      >
        <ScheduleImageCard
          ref={cardRef}
          schedule={schedule}
          churchName={church?.name}
          district={church?.district}
          mode={viewMode}
        />
      </div>

      {/* Modal: Definir Substituto / Nova Pessoa pelo Líder */}
      {replaceModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#002F6C]" />
                Definir Nova Pessoa para a Escala
              </h3>
              <button
                type="button"
                onClick={() => setReplaceModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Dia do Culto:</span>
                <strong className="text-slate-900">{formatScheduleDayWithWeekday(replaceModalItem.date)}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Função / Categoria:</span>
                <strong className="text-slate-900">{replaceModalItem.roleName}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Voluntário Atual / Desistente:</span>
                <strong className="text-red-700">{replaceModalItem.currentMemberName}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmReplacement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Selecione o Novo Voluntário *
                </label>
                <select
                  required
                  value={replacementMemberId}
                  onChange={(e) => setReplacementMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002F6C]"
                >
                  <option value="" className="text-slate-400 bg-white">-- Selecione um membro --</option>
                  {allMembers
                    .filter((m) => m.is_active && m.name !== replaceModalItem.currentMemberName)
                    .map((m) => {
                      const isAlreadyOnDateInSchedule = (schedule?.items || []).some(
                        (it: any) =>
                          it.id !== replaceModalItem.scheduleItemId &&
                          it.date === replaceModalItem.date &&
                          it.member_id === m.id
                      );
                      return (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={isAlreadyOnDateInSchedule}
                          className={isAlreadyOnDateInSchedule ? "text-slate-400 bg-slate-100 italic" : "text-slate-900 bg-white"}
                        >
                          {m.name} {isAlreadyOnDateInSchedule ? "⛔ (Já escalado nesta data)" : m.phone ? `(${m.phone})` : ""}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações da Substituição (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Combinado com ele pelo WhatsApp"
                  value={replaceNotes}
                  onChange={(e) => setReplaceNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReplaceModalItem(null)}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={replaceSubmitting || !replacementMemberId}
                  className="px-4 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {replaceSubmitting ? "Salvando..." : "Confirmar Nova Pessoa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sinalizar Ausência */}
      {absenceModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-slate-900">
            <h3 className="text-base font-bold text-red-700 flex items-center gap-2 mb-2">
              <UserX className="w-5 h-5" />
              Não Poderei Comparecer
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Você está sinalizando que não poderá exercer a função de <strong>{absenceModalItem.role_name}</strong> no <strong>{formatScheduleDayWithWeekday(absenceModalItem.date)}</strong>. O líder da escala será notificado para providenciar um substituto.
            </p>
            <form onSubmit={submitAbsence} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motivo (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Viagem de trabalho, motivo de saúde..."
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAbsenceModalItem(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  {requestSubmitting ? "Enviando..." : "Confirmar Ausência"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Solicitar Troca */}
      {swapModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-slate-900">
            <h3 className="text-base font-bold text-blue-800 flex items-center gap-2 mb-2">
              <Repeat className="w-5 h-5 text-blue-600" />
              Solicitar Troca de Escala
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Troca para a função de <strong>{swapModalItem.role_name}</strong> no <strong>{formatScheduleDayWithWeekday(swapModalItem.date)}</strong>.
            </p>
            <form onSubmit={submitSwap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Membro Substituto que aceitou a troca *
                </label>
                <select
                  required
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none"
                >
                  <option value="" className="text-slate-500 bg-white">-- Selecione o membro --</option>
                  {allMembers
                    .filter((m) => m.id !== user?.id && m.is_active)
                    .map((m) => (
                      <option key={m.id} value={m.id} className="text-slate-900 bg-white">
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Observações / Acordo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Combinado com ele no culto de sábado"
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSwapModalItem(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="px-4 py-1.5 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  {requestSubmitting ? "Enviando..." : "Enviar Pedido de Troca"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}