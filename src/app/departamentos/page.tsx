"use client";

import React, { useState, useEffect } from "react";
import { Layers, Plus, Tag, Palette, Check, AlertCircle } from "lucide-react";

interface Role {
  id: string;
  department_id: string;
  name: string;
  description?: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  roles: Role[];
}

export default function DepartamentosPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Novo Departamento
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptColor, setDeptColor] = useState("#002F6C");

  // Modal Novo Cargo/Função
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [roleName, setRoleName] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      if (data.success) {
        setDepartments(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deptName,
          description: deptDesc,
          color: deptColor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeptName("");
        setDeptDesc("");
        setDeptModalOpen(false);
        loadDepartments();
      } else {
        alert(data.error || "Erro ao criar departamento.");
      }
    } catch (err) {
      alert("Erro ao salvar departamento.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || !selectedDeptId) return;

    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: selectedDeptId,
          name: roleName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRoleName("");
        setRoleModalOpen(false);
        loadDepartments();
      } else {
        alert(data.error || "Erro ao adicionar função.");
      }
    } catch (err) {
      alert("Erro ao adicionar função.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-[#002F6C]" />
            Departamentos e Cargos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os ministérios da igreja e as funções disponíveis para elaboração das escalas.
          </p>
        </div>
        <button
          onClick={() => setDeptModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002F6C] hover:bg-[#002454] text-white font-medium rounded-lg shadow-sm transition text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Departamento
        </button>
      </div>

      {/* Grid de Departamentos */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Carregando departamentos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Faixa Colorida do Departamento */}
                <div
                  className="h-2.5 w-full"
                  style={{ backgroundColor: dept.color || "#002F6C" }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{dept.name}</h2>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-xs shrink-0"
                      style={{ backgroundColor: dept.color }}
                      title={`Cor temática: ${dept.color}`}
                    />
                  </div>
                  {dept.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {dept.description}
                    </p>
                  )}

                  {/* Lista de Cargos */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Funções / Cargos ({dept.roles.length})</span>
                      <button
                        onClick={() => {
                          setSelectedDeptId(dept.id);
                          setRoleModalOpen(true);
                        }}
                        className="text-[#002F6C] hover:underline flex items-center gap-0.5 text-[11px] font-bold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {dept.roles.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200"
                        >
                          <Tag className="w-3 h-3 text-slate-400" />
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar Departamento */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Novo Departamento</h2>
            <form onSubmit={handleCreateDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome do Departamento *
                </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ministério Jovem (JA)"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Descrição
                  </label>
                  <textarea
                    placeholder="Finalidade e atuação deste ministério..."
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                  />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Cor Temática para a Escala / Imagem
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={deptColor}
                    onChange={(e) => setDeptColor(e.target.value)}
                    className="w-10 h-10 rounded border border-slate-200 cursor-pointer p-0.5"
                  />
                  <span className="text-xs font-mono text-slate-500">{deptColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  {saving ? "Salvando..." : "Criar Departamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Cargo/Função */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Adicionar Cargo / Função</h2>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Nome da Função *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Diácono da Porta"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002F6C]/20 focus:border-[#002F6C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#002F6C] hover:bg-[#002454] text-white rounded-lg text-sm font-medium transition cursor-pointer"
                >
                  {saving ? "Salvando..." : "Adicionar Função"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
