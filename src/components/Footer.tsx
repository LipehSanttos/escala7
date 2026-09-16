import React from "react";
import { IasdLogo } from "./IasdLogo";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-xs text-center">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IasdLogo className="h-5 w-5 text-amber-500" />
          <span>Sistema de Escalas • Igreja Adventista do Sétimo Dia</span>
        </div>
        <div>
          <span>"Tudo, porém, seja feito com decência e ordem." — 1 Coríntios 14:40</span>
        </div>
      </div>
    </footer>
  );
}
