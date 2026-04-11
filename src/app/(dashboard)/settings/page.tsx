"use client";

// Anzu Dynamics — Settings Page
// Three tabs: ERP Credentials, Extraction Settings, Billing & Plan.
// Admin-only access enforced at the API layer.

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Pencil, Wifi, WifiOff, Loader2, Save, KeyRound, Settings2, CreditCard,
  ExternalLink, ChevronRight, Sparkles,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Credential {
  id: string;
  erpType: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

interface CredentialFormData {
  label: string;
  erpType: string;
  username: string;
  password: string;
  apiKey: string;
  baseUrl: string;
  tenantCode: string;
}

interface ExtractionSettings {
  default_country: string;
  default_currency: string;
  document_language: string;
  amount_format: string;
  low_confidence_threshold: number;
  extraction_timeout_seconds: number;
  auto_approve_threshold: number | null;
  flag_duplicates: boolean;
  preferred_erp: string | null;
}

interface TestResult {
  credentialId: string;
  success: boolean;
  latencyMs: number;
  message: string;
}

// ── ERP type options ───────────────────────────────────────────────────────────

const ERP_TYPES = [
  { value: "sinco",   label: "SINCO Enterprise" },
  { value: "siigo",   label: "Siigo" },
  { value: "sap_b1",  label: "SAP Business One" },
  { value: "contpaq", label: "CONTPAQi" },
  { value: "mock",    label: "Demo / Sandbox" },
  { value: "custom",  label: "Custom / Other" },
];

const ERP_REQUIRES_BROWSER = new Set(["sinco", "sap_b1", "contpaq"]);

// ── Blank form state ───────────────────────────────────────────────────────────

const BLANK_FORM: CredentialFormData = {
  label: "", erpType: "sinco", username: "", password: "",
  apiKey: "", baseUrl: "", tenantCode: "",
};

// ══════════════════════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage ERP credentials, extraction behaviour, and billing for your organization.
        </p>
      </div>

      <Tabs defaultValue="credentials">
        <TabsList className="mb-6">
          <TabsTrigger value="credentials" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            ERP Credentials
          </TabsTrigger>
          <TabsTrigger value="extraction" className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Extraction
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials">
          <CredentialsTab />
        </TabsContent>
        <TabsContent value="extraction">
          <ExtractionTab />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1 — ERP Credentials
// ══════════════════════════════════════════════════════════════════════════════

function CredentialsTab() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading]         = useState(true);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState<CredentialFormData>(BLANK_FORM);
  const [saving, setSaving]           = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testing, setTesting]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { credentials: Credential[] };
      setCredentials(data.credentials);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setDialogOpen(true);
  }

  function openEdit(cred: Credential) {
    setEditingId(cred.id);
    setForm({ ...BLANK_FORM, label: cred.label, erpType: cred.erpType });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const credData = {
        username: form.username || undefined,
        password: form.password || undefined,
        apiKey:   form.apiKey   || undefined,
        baseUrl:  form.baseUrl  || undefined,
        tenantCode: form.tenantCode || undefined,
      };

      const url    = editingId ? `/api/credentials/${editingId}` : "/api/credentials";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: form.label, erpType: form.erpType, data: credData }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Save failed");
      }

      setDialogOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      await load();
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const res = await fetch(`/api/credentials/${id}/test`, { method: "POST" });
      const data = (await res.json()) as TestResult & { error?: string };
      setTestResults((prev) => ({ ...prev, [id]: { ...data, credentialId: id } }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: { credentialId: id, success: false, latencyMs: 0, message: "Request failed" },
      }));
    } finally {
      setTesting(null);
    }
  }

  const needsBrowser = ERP_REQUIRES_BROWSER.has(form.erpType);
  const isApi        = form.erpType === "siigo";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>ERP Credentials</CardTitle>
            <CardDescription>
              Encrypted with AES-256-GCM. Secrets are never returned to the browser.
            </CardDescription>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Credential
          </Button>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No ERP credentials yet. Add one to enable automated invoice submission.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {credentials.map((cred) => {
                const test = testResults[cred.id];
                const isTesting = testing === cred.id;

                return (
                  <div key={cred.id} className="flex items-center gap-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {cred.label}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {ERP_TYPES.find((e) => e.value === cred.erpType)?.label ?? cred.erpType}
                        </Badge>
                        {test && (
                          <Badge variant={test.success ? "success" : "destructive"} className="shrink-0">
                            {test.success
                              ? <><Wifi className="h-3 w-3 mr-1" />{test.latencyMs}ms</>
                              : <><WifiOff className="h-3 w-3 mr-1" />Failed</>}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Added {new Date(cred.createdAt).toLocaleDateString()}
                        {test && !test.success && (
                          <span className="text-red-500 ml-2">{test.message}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(cred.id)}
                        disabled={isTesting}
                      >
                        {isTesting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Wifi className="h-3.5 w-3.5" />}
                        <span className="ml-1.5 hidden sm:inline">Test</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(cred)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="ml-1.5 hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                        onClick={() => setDeleteId(cred.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Credential" : "Add ERP Credential"}</DialogTitle>
            <DialogDescription>
              Credentials are encrypted before storage. Secrets are never logged or returned via the API.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="e.g. SINCO Production"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="erpType">ERP System</Label>
              <Select
                value={form.erpType}
                onValueChange={(v) => setForm((f) => ({ ...f, erpType: v }))}
              >
                <SelectTrigger id="erpType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ERP_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {needsBrowser && (
                <p className="text-xs text-amber-600">
                  This ERP uses Playwright browser automation. Requires the worker process with Playwright installed.
                </p>
              )}
            </div>

            {!isApi && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    autoComplete="off"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editingId ? "Leave blank to keep existing" : ""}
                  />
                </div>
              </>
            )}

            {isApi && (
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">Access Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  autoComplete="new-password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder={editingId ? "Leave blank to keep existing" : ""}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="baseUrl">Base URL <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="baseUrl"
                placeholder="https://erp.mycompany.com"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              />
            </div>

            {needsBrowser && (
              <div className="space-y-1.5">
                <Label htmlFor="tenantCode">Company / Empresa Code <span className="text-gray-400 font-normal">(optional)</span></Label>
                <Input
                  id="tenantCode"
                  placeholder="e.g. 001"
                  value={form.tenantCode}
                  onChange={(e) => setForm((f) => ({ ...f, tenantCode: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.label}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Save Changes" : "Add Credential"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Credential</DialogTitle>
            <DialogDescription>
              This will permanently remove the credential. Any running RPA jobs using it will fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Extraction Settings
// ══════════════════════════════════════════════════════════════════════════════

const COUNTRY_OPTIONS = [
  { value: "CO", label: "Colombia (CO)" },
  { value: "MX", label: "Mexico (MX)" },
  { value: "US", label: "United States (US)" },
  { value: "ES", label: "Spain (ES)" },
];

const CURRENCY_OPTIONS = [
  { value: "COP", label: "COP — Colombian Peso" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
];

function ExtractionTab() {
  const [settings, setSettings] = useState<Partial<ExtractionSettings>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings");
      if (res.ok) setSettings(await res.json() as ExtractionSettings);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Regional Defaults</CardTitle>
          <CardDescription>Used for currency inference and OCR context.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Default Country</Label>
            <Select
              value={settings.default_country ?? "CO"}
              onValueChange={(v) => setSettings((s) => ({ ...s, default_country: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Default Currency</Label>
            <Select
              value={settings.default_currency ?? "COP"}
              onValueChange={(v) => setSettings((s) => ({ ...s, default_currency: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Document Language</Label>
            <Select
              value={settings.document_language ?? "es"}
              onValueChange={(v) => setSettings((s) => ({ ...s, document_language: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="es">Spanish (es)</SelectItem>
                <SelectItem value="en">English (en)</SelectItem>
                <SelectItem value="pt">Portuguese (pt)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Amount Format</Label>
            <Select
              value={settings.amount_format ?? "auto"}
              onValueChange={(v) => setSettings((s) => ({ ...s, amount_format: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="latin_american">Latin American (1.000,00)</SelectItem>
                <SelectItem value="us">US / International (1,000.00)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extraction Behaviour</CardTitle>
          <CardDescription>Control confidence thresholds and auto-approval.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="conf-threshold">
              Low Confidence Threshold
              <span className="ml-1 text-gray-400 font-normal">
                ({((settings.low_confidence_threshold ?? 0.85) * 100).toFixed(0)}%)
              </span>
            </Label>
            <Input
              id="conf-threshold"
              type="number"
              min="0.5"
              max="0.95"
              step="0.05"
              value={settings.low_confidence_threshold ?? 0.85}
              onChange={(e) =>
                setSettings((s) => ({ ...s, low_confidence_threshold: parseFloat(e.target.value) }))
              }
            />
            <p className="text-xs text-gray-400">Fields below this score get a low_confidence flag.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timeout">Extraction Timeout (seconds)</Label>
            <Input
              id="timeout"
              type="number"
              min="10"
              max="60"
              value={settings.extraction_timeout_seconds ?? 45}
              onChange={(e) =>
                setSettings((s) => ({ ...s, extraction_timeout_seconds: parseInt(e.target.value) }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auto-approve">Auto-approve Threshold</Label>
            <Input
              id="auto-approve"
              type="number"
              min="0.8"
              max="1"
              step="0.05"
              placeholder="0 = disabled"
              value={settings.auto_approve_threshold ?? ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  auto_approve_threshold: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
            <p className="text-xs text-gray-400">
              If all core fields meet this confidence, invoice is auto-reviewed. Leave blank to disable.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Flag Duplicates</Label>
            <Select
              value={settings.flag_duplicates === false ? "false" : "true"}
              onValueChange={(v) =>
                setSettings((s) => ({ ...s, flag_duplicates: v === "true" }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
            : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Billing & Plan
// ══════════════════════════════════════════════════════════════════════════════

interface TenantInfo {
  subscription?: { plan: string; status: string; currentPeriodEnd: string | null };
  invoicesThisMonth?: number;
}

const PLAN_QUOTAS: Record<string, number> = {
  demo: 25, starter: 500, growth: 3000, enterprise: Infinity,
};

const PLAN_LABELS: Record<string, string> = {
  demo: "Demo", starter: "Starter", growth: "Growth", enterprise: "Enterprise",
};

const UPGRADE_PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$990/mo",
    invoices: "500 invoices/month",
    features: ["1 user", "Email & web capture", "Basic OCR + AI", "1 ERP integration"],
  },
  {
    id: "growth" as const,
    name: "Growth",
    price: "$2,490/mo",
    invoices: "3,000 invoices/month",
    features: ["10 users", "WhatsApp + API webhooks", "Advanced LLM extraction", "1 RPA connector", "Multi-level approvals"],
    highlight: true,
  },
];

function BillingTab() {
  const [info, setInfo]           = useState<TenantInfo>({});
  const [loading, setLoading]     = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    // Show success toast if redirected back from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Reload page to reflect updated plan
      window.history.replaceState({}, "", "/settings?tab=billing");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/tenant");
      if (res.ok) setInfo(await res.json() as TenantInfo);
      setLoading(false);
    })();
  }, []);

  async function handleCheckout(plan: "starter" | "growth") {
    setCheckingOut(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setCheckingOut(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open portal");
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const plan  = info.subscription?.plan ?? "demo";
  const quota = PLAN_QUOTAS[plan] ?? 25;
  const used  = info.invoicesThisMonth ?? 0;
  const pct   = quota === Infinity ? 0 : Math.min(100, Math.round((used / quota) * 100));
  const isPaid = plan !== "demo";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your organization&apos;s subscription details.</CardDescription>
            </div>
            {isPaid && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handlePortal()}
                disabled={portalLoading}
              >
                {portalLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                }
                Manage Billing
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={plan === "demo" ? "secondary" : "default"} className="text-sm px-3 py-1">
              {PLAN_LABELS[plan] ?? plan}
            </Badge>
            <Badge variant={info.subscription?.status === "active" ? "success" : "warning"}>
              {info.subscription?.status ?? "active"}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Invoices this month</span>
              <span className="font-medium text-gray-900">
                {used} / {quota === Infinity ? "Unlimited" : quota.toLocaleString()}
              </span>
            </div>
            {quota !== Infinity && (
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-orange-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>

          {info.subscription?.currentPeriodEnd && (
            <p className="text-xs text-gray-400">
              Renews on{" "}
              {new Date(info.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade card — shown for demo plan or when upgrade flow is open */}
      {!isPaid && (
        <Card className={showUpgrade ? "border-orange-300" : "border-orange-200 bg-orange-50"}>
          {!showUpgrade ? (
            <CardContent className="pt-6">
              <p className="text-sm text-orange-800 font-medium mb-1">
                You&apos;re on the Demo plan (25 invoices/month).
              </p>
              <p className="text-sm text-orange-700 mb-4">
                Upgrade to process more invoices, unlock fine-tuning, and get priority support. 30-day free trial — no credit card charged until the trial ends.
              </p>
              <Button size="sm" onClick={() => setShowUpgrade(true)} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Upgrade Plan
              </Button>
            </CardContent>
          ) : (
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-900">Choose a plan — 30-day free trial</p>
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {UPGRADE_PLANS.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-xl border-2 p-4 ${
                      p.highlight ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    {p.highlight && (
                      <span className="inline-block text-xs font-bold text-orange-600 mb-2">Most popular</span>
                    )}
                    <div className="font-semibold text-gray-900 text-sm mb-0.5">{p.name}</div>
                    <div className="text-lg font-bold text-gray-900 mb-0.5">{p.price}</div>
                    <div className="text-xs text-gray-500 mb-3">{p.invoices}</div>
                    <ul className="space-y-1 mb-4">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <ChevronRight className="h-3 w-3 text-orange-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={p.highlight ? "default" : "outline"}
                      onClick={() => void handleCheckout(p.id)}
                      disabled={checkingOut !== null}
                    >
                      {checkingOut === p.id
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Redirecting…</>
                        : "Start free trial"
                      }
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                No charge until the 30-day trial ends. Cancel anytime.
              </p>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
