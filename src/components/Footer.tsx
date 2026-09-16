import React from "react";
import { IasdLogo } from "./IasdLogo";
import { Sparkles, Heart } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800/80 text-xs">
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
        {/* Linha Principal Institucional */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <IasdLogo className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="font-medium text-slate-300">
              Sistema de Escalas • Igreja Adventista do Sétimo Dia
            </span>
          </div>
          <div className="text-slate-400 italic">
            <span>"Tudo, porém, seja feito com decência e ordem." — 1 Coríntios 14:40</span>
          </div>
        </div>

        {/* Linha de Assinatura & Créditos */}
        <div className="w-full pt-4 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400">
          <span className="text-[11px]">
            &copy; {currentYear} escala7 • Gestão Eclesiástica Inteligente
          </span>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 hover:border-slate-700 hover:bg-slate-900 transition-all shadow-sm">
            <span>Feito com</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
            <span>por</span>
            <span className="font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
              Eduardo Felipe
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
