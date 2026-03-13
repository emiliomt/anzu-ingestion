"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, Loader2, X, Check, Download, Upload,
  FileSpreadsheet, FolderOpen, Settings2, AlertCircle,
} from "lucide-react";
import type { Project } from "@/types/invoice";

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-green-100 text-green-700 border border-green-200",
  closed:  "bg-gray-100 text-gray-600 border border-gray-200",
  on_hold: "bg-amber-100 text-amber-700 border border-amber-200",
};

const STATUS_LABELS: Record<string, string> = {
  active:  "Active",
  closed:  "Closed",
  on_hold: "On Hold",
};

const EMPTY: Partial<Project> = {
  name: "", code: "", address: "", city: "", vat: "",
  supervisor: "", currency: "COP", status: "active", description: "",
};

export default function ProjectsPage() {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("all");
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Project | null>(null);
  const [form, setForm]             = useState<Partial<Project>>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === "all" ? "/api/projects" : `/api/projects?status=${filter}`;
    const data = await fetch(url).then((r) => r.json() as Promise<Project[]>);
    setProjects(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Stats derived from ALL projects (unfiltered) — load once for stats cards
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setAllProjects);
  }, [projects]); // refresh when projects change

  const total   = allProjects.length;
  const active  = allProjects.filter((p) => p.status === "active").length;
  const onHold  = allProjects.filter((p) => p.status === "on_hold").length;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({ ...p });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/projects/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setDeleting(null);
    await load();
  }

  async function deleteAll() {
    if (!confirm(`Delete all ${projects.length} project(s)? This cannot be undone.`)) return;
    setDeletingAll(true);
    await Promise.all(projects.map((p) => fetch(`/api/projects/${p.id}`, { method: "DELETE" })));
    setDeletingAll(false);
    await load();
  }

  function downloadTemplate() {
    window.open("/api/projects/template", "_blank");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/projects/import", { method: "POST", body: fd });
    const result = await res.json() as { created: number; errors: string[] };
    setImportResult(result);
    setImporting(false);
    if (result.created > 0) await load();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
              <p className="text-sm text-gray-500">Configure and manage construction projects for invoice matching</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Download Template
          </button>
          <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</> : "Import Excel"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <button
            onClick={deleteAll}
            disabled={deletingAll || projects.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            {deletingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete All
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Project
          </button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`mb-6 p-4 rounded-xl border text-sm flex items-start gap-3 ${importResult.errors.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${importResult.errors.length > 0 ? "text-amber-500" : "text-green-500"}`} />
          <div className="flex-1">
            <p className="font-medium text-gray-800">{importResult.created} project(s) imported successfully.</p>
            {importResult.errors.length > 0 && (
              <ul className="mt-1 text-amber-700 space-y-0.5">
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Total Records</p>
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Active</p>
            <Check className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">{active}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">On Hold / Closed</p>
            <Settings2 className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600">{onHold + (allProjects.filter((p) => p.status === "closed").length)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Settings2 className="w-4 h-4" />
          Filter by status:
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
        >
          <option value="all">All Projects</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Project Records</h2>
          <p className="text-xs text-gray-400 mt-0.5">Records used for invoice-to-project matching</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No projects found</p>
            <p className="text-sm mt-1">Add a project manually or import from Excel.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">VAT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supervisor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900 leading-tight">{p.name}</p>
                    {p.code && <p className="text-xs text-gray-400 mt-0.5">{p.code}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 max-w-[200px] truncate">{p.address ?? "—"}</td>
                  <td className="px-4 py-3.5 text-gray-500">{p.city ?? "—"}</td>
                  <td className="px-4 py-3.5 text-gray-500">{p.vat ?? "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600">{p.supervisor ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        disabled={deleting === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === p.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">
                {editing ? "Edit Project" : "New Project"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Project Name *</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. URBANISMO PH - PUENTE LA CAROLINA"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.code ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="PROJ-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.city ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Bogotá"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.address ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Calle 68 B N° Transv 1 Sur 113"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">VAT / NIT</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.vat ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, vat: e.target.value }))}
                    placeholder="900123456-7"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supervisor</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.supervisor ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, supervisor: e.target.value }))}
                    placeholder="Yina Orozco"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Budget</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.budget ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.currency ?? "COP"}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {["COP","USD","MXN","ARS","BRL","PEN","CLP","EUR"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.status ?? "active"}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Project["status"] }))}
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name?.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editing ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
