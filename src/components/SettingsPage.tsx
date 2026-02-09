import { useState, useEffect } from "react";
import { fetchSettings, saveSettings, testEmbeddingConnection, type EmbeddingSettings, getBaseUrl } from "../api";
import { Gear, FloppyDisk, Lightning, CheckCircle, XCircle, Database, Files } from "@phosphor-icons/react";
import { useLocale } from "../hooks/useLocale";

export function SettingsPage() {
  const { t } = useLocale();
  const [settings, setSettings] = useState<EmbeddingSettings>({
    enabled: false,
    apiUrl: "",
    apiKey: "",
    model: "",
    apiKeySet: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [embStats, setEmbStats] = useState<{ cachedFiles: number; totalFiles: number; coverage: number; dbSize: number; model: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadEmbStats();
  }, []);

  const loadEmbStats = async () => {
    try {
      const r = await fetch(`${getBaseUrl()}/api/settings/embedding-stats`);
      setEmbStats(await r.json());
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const data = await fetchSettings();
      setSettings(data.embedding);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EmbeddingSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setTouched(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({ embedding: settings });
      setTouched(false);
      // Reload to get the safe version (with apiKey hidden)
      await loadSettings();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testEmbeddingConnection(settings);
      setTestResult({
        success: result.success,
        message: result.error || "Connection successful"
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Test failed"
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-faint)" }}>
        <div className="w-5 h-5 border-2 border-t-blue-400 rounded-full animate-spin mr-3" style={{ borderColor: "var(--border)" }} />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <Gear className="w-7 h-7 text-blue-400" /> {t("settings.title") || "⚙️ Settings"}
      </h1>

      {/* Embedding Settings */}
      <section className="rounded-xl p-5" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          {t("settings.embedding.title") || "向量搜索 (Embedding)"}
        </h2>
        
        <div className="space-y-4">
          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium" style={{ color: "var(--text-secondary)" }}>
                {t("settings.embedding.enable") || "启用向量搜索"}
              </div>
              <div className="text-sm" style={{ color: "var(--text-faint)" }}>
                {t("settings.embedding.enableDesc") || "使用 OpenAI Embeddings API 进行语义搜索"}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => handleChange("enabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 rounded-full peer bg-gray-700 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-800" style={{ background: settings.enabled ? "var(--link)" : "var(--border)" }}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${settings.enabled ? "translate-x-5" : ""}`} style={{ background: "var(--bg-primary)" }} />
              </div>
            </label>
          </div>

          {settings.enabled && (
            <div className="space-y-4 pt-2">
              {/* API URL */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  {t("settings.embedding.apiUrl") || "API 地址"}
                </label>
                <input
                  type="text"
                  value={settings.apiUrl}
                  onChange={(e) => handleChange("apiUrl", e.target.value)}
                  placeholder="https://api.openai.com/v1/embeddings"
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
                <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                  {t("settings.embedding.apiUrlDesc") || "OpenAI Embeddings API 或兼容的端点"}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  {t("settings.embedding.apiKey") || "API 密钥"}
                </label>
                <input
                  type="password"
                  value={settings.apiKeySet ? "••••••" : settings.apiKey}
                  onChange={(e) => handleChange("apiKey", e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
                <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                  {settings.apiKeySet 
                    ? (t("settings.embedding.apiKeySet") || "API 密钥已设置")
                    : (t("settings.embedding.apiKeyDesc") || "OpenAI API 密钥 (sk-...)")}
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  {t("settings.embedding.model") || "模型"}
                </label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  placeholder="text-embedding-3-small"
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
                <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
                  {t("settings.embedding.modelDesc") || "Embedding 模型名称，如 text-embedding-3-small"}
                </div>
              </div>

              {/* Test Connection */}
              <div className="pt-2">
                <button
                  onClick={handleTest}
                  disabled={testing || !settings.apiUrl || !settings.apiKey || !settings.model}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {testing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-blue-400 rounded-full animate-spin" style={{ borderColor: "var(--border)" }} />
                      {t("settings.embedding.testing") || "测试中..."}
                    </>
                  ) : (
                    <>
                      <Lightning className="w-4 h-4" />
                      {t("settings.embedding.test") || "测试连接"}
                    </>
                  )}
                </button>

                {testResult && (
                  <div className={`flex items-center gap-2 mt-2 text-sm ${testResult.success ? "text-green-400" : "text-red-400"}`}>
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Embedding Stats */}
        {settings.enabled && embStats && embStats.cachedFiles > 0 && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              <Database size={16} className="text-blue-400" />
              Embedding 缓存状态
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {embStats.cachedFiles}/{embStats.totalFiles}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>已缓存文件</div>
              </div>
              <div>
                <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {embStats.coverage}%
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>覆盖率</div>
              </div>
              <div>
                <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {embStats.dbSize > 1048576 ? `${(embStats.dbSize / 1048576).toFixed(1)}MB` : `${Math.round(embStats.dbSize / 1024)}KB`}
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>缓存大小</div>
              </div>
            </div>
            {/* Coverage bar */}
            <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${embStats.coverage}%` }}
              />
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>
              模型: {embStats.model}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleSave}
            disabled={saving || !touched}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--link)",
              color: "white",
            }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)" }} />
                {t("settings.saving") || "保存中..."}
              </>
            ) : (
              <>
                <FloppyDisk className="w-4 h-4" />
                {t("settings.save") || "保存设置"}
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}