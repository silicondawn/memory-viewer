import { useState, useEffect } from "react";
import { Gear, FloppyDisk, Lightning, CheckCircle, XCircle, ArrowLeft } from "@phosphor-icons/react";
import { getBaseUrl } from "../api";
import { useLocale } from "../hooks/useLocale";

interface EmbeddingSettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  apiKeySet: boolean;
  model: string;
}

interface Settings {
  embedding: EmbeddingSettings;
}

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();
  const [settings, setSettings] = useState<Settings>({
    embedding: { enabled: false, apiUrl: "", apiKey: "", apiKeySet: false, model: "" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ ok: boolean } | null>(null);

  useEffect(() => {
    fetch(`${getBaseUrl()}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          embedding: {
            enabled: data.embedding?.enabled ?? false,
            apiUrl: data.embedding?.apiUrl ?? "",
            apiKey: "",
            apiKeySet: data.embedding?.apiKeySet ?? false,
            model: data.embedding?.model ?? "",
          },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateEmbedding = (patch: Partial<EmbeddingSettings>) => {
    setSettings((s) => ({ ...s, embedding: { ...s.embedding, ...patch } }));
    setSaveResult(null);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        embedding: {
          enabled: settings.embedding.enabled,
          apiUrl: settings.embedding.apiUrl,
          model: settings.embedding.model,
        },
      };
      // Only send apiKey if user typed a new one
      if (settings.embedding.apiKey) {
        body.embedding.apiKey = settings.embedding.apiKey;
      }
      const r = await fetch(`${getBaseUrl()}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaveResult({ ok: r.ok });
      if (r.ok) {
        setSettings((s) => ({
          ...s,
          embedding: { ...s.embedding, apiKey: "", apiKeySet: true },
        }));
      }
    } catch {
      setSaveResult({ ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`${getBaseUrl()}/api/settings/test-embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: settings.embedding.apiUrl,
          apiKey: settings.embedding.apiKey || undefined,
          model: settings.embedding.model,
        }),
      });
      const data = await r.json();
      setTestResult({ ok: data.ok, message: data.message });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-t-blue-400 rounded-full animate-spin" style={{ borderColor: "var(--border)" }} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={20} />
          </button>
          <Gear size={24} style={{ color: "var(--text-faint)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("settings.title")}
          </h1>
        </div>

        {/* Embedding Section */}
        <div className="rounded-lg p-5 mb-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              🧠 {t("settings.embedding.title")}
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.embedding.enabled}
                onChange={(e) => updateEmbedding({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
            {t("settings.embedding.description")}
          </p>

          <div className="space-y-3">
            {/* API URL */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                API URL
              </label>
              <input
                type="text"
                value={settings.embedding.apiUrl}
                onChange={(e) => updateEmbedding({ apiUrl: e.target.value })}
                placeholder="https://api.openai.com/v1/embeddings"
                className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none focus:ring-1 focus:ring-blue-500"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                API Key
              </label>
              <input
                type="password"
                value={settings.embedding.apiKey}
                onChange={(e) => updateEmbedding({ apiKey: e.target.value })}
                placeholder={settings.embedding.apiKeySet ? "••••••••（已设置，留空保持不变）" : "sk-..."}
                className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none focus:ring-1 focus:ring-blue-500"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                {t("settings.embedding.model")}
              </label>
              <input
                type="text"
                value={settings.embedding.model}
                onChange={(e) => updateEmbedding({ model: e.target.value })}
                placeholder="text-embedding-3-small"
                className="w-full px-3 py-2 rounded-md text-sm bg-transparent outline-none focus:ring-1 focus:ring-blue-500"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleTest}
              disabled={testing || !settings.embedding.apiUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <Lightning size={14} />
              {testing ? t("settings.testing") : t("settings.testConnection")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: "#3b82f6" }}
            >
              <FloppyDisk size={14} />
              {saving ? t("settings.saving") : t("settings.save")}
            </button>

            {testResult && (
              <span className={`flex items-center gap-1 text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.message}
              </span>
            )}
            {saveResult && (
              <span className={`flex items-center gap-1 text-xs ${saveResult.ok ? "text-green-400" : "text-red-400"}`}>
                {saveResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {saveResult.ok ? t("settings.saved") : t("settings.saveFailed")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
