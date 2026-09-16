"use client";

import React, { useState, useEffect } from "react";
import { 
  Bell, 
  Send, 
  Copy, 
  Check, 
  Calendar, 
  Phone, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  Search,
  Filter,
  Lock
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ReminderItem {
  item_id: string;
  date: string;
  service_type: string;
  role_name: string;
  department_name: string;
  department_color: string;
  schedule_id: string;
  schedule_title: string;
  member_id: string;
  member_name: string;
  member_phone: string;
}

export default function LembretesPage() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [church, setChurch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtros de Data
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split("T")[0];

  const [selectedFilter, setSelectedFilter] = useState<"all" | "tomorrow" | "today">("all");
  const [customDate, setCustomDate] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/reminders").then((r) => r.json()),
      fetch("/api/church").then((r) => r.json()),
    ])
      .then(([rData, cData]) => {
        if (rData.success) setReminders(rData.data);
        if (cData.success) setChurch(cData.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const generateReminderText = (item: ReminderItem) => {
    const churchName = church?.name || "Igreja Adventista do Sétimo Dia";
    const parts = item.date.split("-");
    const formattedDate = `${parts[2]}/${parts[1]}`;

    return `Olá, *${item.member_name}*! Que a graça e a paz de Deus estejam com você! 🙏✨\n\nLembramos carinhosamente que você está escalado(a) no dia *${formattedDate}* (${item.service_type}) para a função de *${item.role_name}* no ministério de *${item.department_name}* na *${churchName}*.\n\nContamos com sua pontualidade e dedicação no serviço a Deus! 💒\n\n_Caso haja algum imprevisto inadiável, sinalize com antecedência ao líder da escala._\nTenha uma abençoada semana!`;
  };

  const handleCopy = (item: ReminderItem) => {
    const text = generateReminderText(item);
    navigator.clipboard.writeText(text);
    setCopiedId(item.item_id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendWhatsApp = (item: ReminderItem) => {
    const text = generateReminderText(item);
    const cleanPhone = item.member_phone.replace(/\D/g, "");
    // Adicionar código do Brasil 55 caso não tenha
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${fullPhone}?text=${encoded}`, "_blank");
  };

  const filteredReminders = reminders.filter((item) => {
    if (selectedFilter === "today") return item.date === todayStr;
    if (selectedFilter === "tomorrow") return item.date === tomorrowStr;
    if (customDate) return item.date === customDate;
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-[#002F6C]" />
            Central de Lembretes Pré-Culto
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Envie com 1 clique o aviso personalizado de escala no WhatsApp de cada membro escalado.
          </p>
        </div>
      </div>

      {/* Aviso de Modo Público com Contatos Protegidos */}
      {!user && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <span className="font-bold text-slate-800">Modo de Visualização Protegido:</span> Os números de WhatsApp e o disparo direto de lembretes estão bloqueados para visitantes deslogados. Conecte-se como líder para utilizar o envio automático.
            </div>
          </div>
        </div>
      )}

      {/* Seletor de Período / Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedFilter("all"); setCustomDate(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedFilter === "all" && !customDate
                ? "bg-[#002F6C] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas as Datas
          </button>
          <button
            onClick={() => { setSelectedFilter("tomorrow"); setCustomDate(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedFilter === "tomorrow"
                ? "bg-[#002F6C] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Aviso de Amanhã (1 dia antes)
          </button>
          <button
            onClick={() => { setSelectedFilter("today"); setCustomDate(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedFilter === "today"
                ? "bg-[#002F6C] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Culto de Hoje
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Filtrar por data específica:</span>
          <input
            type="date"
            value={customDate}
            onChange={(e) => { setCustomDate(e.target.value); setSelectedFilter("all"); }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de Membros para Disparo de Lembrete */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Carregando alocações de culto...</div>
      ) : filteredReminders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Nenhum membro escalado para o filtro selecionado</h3>
          <p className="text-xs text-slate-500 mt-1">
            Altere os filtros acima para visualizar membros escalados em outras datas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReminders.map((item) => (
            <div
              key={item.item_id}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: item.department_color || "#002F6C" }}
                  >
                    {item.department_name}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {item.service_type}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    🗓️ {item.date}
                  </span>
                </div>

                <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{item.member_name}</span>
                  <span className="text-xs font-medium text-slate-500 font-normal">
                    — Função: <strong className="text-slate-800">{item.role_name}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {!user ? (
                    <span
                      className="inline-flex items-center gap-1 font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]"
                      title="Contato protegido: Faça login para visualizar o WhatsApp"
                    >
                      <Lock className="w-3 h-3 text-slate-400" />
                      🔒 Contato Protegido
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-mono text-emerald-700">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      {item.member_phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                    </span>
                  )}
                  <span>Escala: {item.schedule_title}</span>
                </div>
              </div>

              {/* Ações Rápidas de Disparo */}
              <div className="flex items-center gap-2 shrink-0">
                {user ? (
                  <>
                    <button
                      onClick={() => handleCopy(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                      title="Copiar mensagem pré-formatada"
                    >
                      {copiedId === item.item_id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      {copiedId === item.item_id ? "Copiado!" : "Copiar"}
                    </button>

                    <button
                      onClick={() => handleSendWhatsApp(item)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                      title="Abre o WhatsApp com a mensagem personalizada pronta para envio"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Lembrar no WhatsApp
                    </button>
                  </>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-400 text-xs font-medium rounded-lg border border-slate-200"
                    title="Faça login como líder para enviar lembretes"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Envio Bloqueado (Deslogado)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}