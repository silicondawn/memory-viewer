import { useState } from "react";
import { type BotConnection } from "../hooks/useConnections";
import { Network, Plus, Trash2, Edit3, Check, X, RefreshCw } from "lucide-react";
import { useLocale } from "../hooks/useLocale";
import { BootstrapWizard } from "./BootstrapWizard";

interface ConnectionsProps {
  connections: BotConnection[];
  statuses: Record<string, boolean>;
  activeId: string;
  onAdd: (conn: Omit<BotConnection, "id">) => void;
  onUpdate: (id: string, updates: Partial<BotConnection>) => void;
  onRemove: (id: string) => void;
  onSwitch: (id: string) => void;
  onRefresh: () => void;
}

type ConnMode = "direct" | "gateway";

interface GatewayBootstrap {
  name: string;
  gatewayUrl: string;
  token: string;
  mvPort: number;
}

export function Connections({ connections, statuses, activeId, onAdd, onUpdate, onRemove, onSwitch, onRefresh }: ConnectionsProps) {
  const { t } = useLocale();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mode, setMode] = useState<ConnMode>("direct");
  const [form, setForm] = useState({ name: "", url: "", token: "" });
  const [gwForm, setGwForm] = useState({ name: "", gatewayUrl: "", token: "", mvPort: "8901" });
  const [bootstrap, setBootstrap] = useState<GatewayBootstrap | null>(null);

  const startAdd = () => {
    setForm({ name: "", url: "", token: "" });
    setGwForm({ name: "", gatewayUrl: "", token: "", mvPort: "8901" });
    setEditId(null);
    setMode("direct");
    setShowForm(true);
  };

  const startEdit = (conn: BotConnection) => {
    setForm({ name: conn.name, url: conn.url, token: conn.token || "" });
    setEditId(conn.id);
    setMode("direct");
    setShowForm(true);
  };

  const save = () => {
    if (mode === "direct") {
      if (!form.name.trim() || !form.url.trim()) return;
      if (editId) {
        onUpdate(editId, { name: form.name.trim(), url: form.url.trim(), token: form.token.trim() || undefined });
      } else {
        onAdd({ name: form.name.trim(), url: form.url.trim(), token: form.token.trim() || undefined });
      }
      setShowForm(false);
      setEditId(null);
      setTimeout(onRefresh, 500);
    } else {
      // Gateway mode — start bootstrap
      if (!gwForm.name.trim() || !gwForm.gatewayUrl.trim() || !gwForm.token.trim()) return;
      setBootstrap({
        name: gwForm.name.trim(),
        gatewayUrl: gwForm.gatewayUrl.trim(),
        token: gwForm.token.trim(),
        mvPort: parseInt(gwForm.mvPort) || 8901,
      });
      setShowForm(false);
    }
  };

  const handleBootstrapComplete = (mvUrl: string) => {
    if (!bootstrap) return;
    onAdd({ name: bootstrap.name, url: mvUrl });
    setTimeout(onRefresh, 500);
  };

  const inputStyle = {
    background: "var(--bg-hover)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Network className="w-7 h-7 text-blue-400" /> {t("connections.title")}
        </h1>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="btn-secondary text-sm flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> {t("connections.refresh")}
          </button>
          <button onClick={startAdd} className="btn-secondary text-sm flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> {t("connections.add")}
          </button>
        </div>
      </div>

      {/* Bootstrap Wizard */}
      {bootstrap && (
        <BootstrapWizard
          name={bootstrap.name}
          gatewayUrl={bootstrap.gatewayUrl}
          token={bootstrap.token}
          mvPort={bootstrap.mvPort}
          onComplete={handleBootstrapComplete}
          onCancel={() => setBootstrap(null)}
        />
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {editId ? t("connections.edit") : t("connections.addNew")}
            </h3>
            {!editId && (
              <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: "1px solid var(--border)" }}>
                <button
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    background: mode === "direct" ? "var(--accent)" : "var(--bg-hover)",
                    color: mode === "direct" ? "#fff" : "var(--text-secondary)",
                  }}
                  onClick={() => setMode("direct")}
                >
                  {t("connections.modeDirect")}
                </button>
                <button
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    background: mode === "gateway" ? "var(--accent)" : "var(--bg-hover)",
                    color: mode === "gateway" ? "#fff" : "var(--text-secondary)",
                  }}
                  onClick={() => setMode("gateway")}
                >
                  {t("connections.modeGateway")}
                </button>
              </div>
            )}
          </div>

          {mode === "direct" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                placeholder={t("connections.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                placeholder={t("connections.urlPlaceholder")}
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                placeholder={t("connections.tokenPlaceholder")}
                value={form.token}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                placeholder={t("connections.namePlaceholder")}
                value={gwForm.name}
                onChange={(e) => setGwForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                placeholder={t("connections.gatewayUrlPlaceholder")}
                value={gwForm.gatewayUrl}
                onChange={(e) => setGwForm((f) => ({ ...f, gatewayUrl: e.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                type="password"
                placeholder={t("connections.gatewayTokenPlaceholder")}
                value={gwForm.token}
                onChange={(e) => setGwForm((f) => ({ ...f, token: e.target.value }))}
              />
              <input
                className="px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
                placeholder={t("connections.mvPortPlaceholder")}
                value={gwForm.mvPort}
                onChange={(e) => setGwForm((f) => ({ ...f, mvPort: e.target.value }))}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} className="btn-secondary text-sm flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {mode === "gateway" && !editId ? t("bootstrap.install") : t("connections.save")}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="btn-secondary text-sm flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> {t("connections.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Connection list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {connections.map((conn) => {
          const online = statuses[conn.id] ?? false;
          const isActive = conn.id === activeId;
          return (
            <div
              key={conn.id}
              className="rounded-xl p-4 cursor-pointer transition-all"
              style={{
                background: "var(--bg-tertiary)",
                border: isActive ? "2px solid #3b82f6" : "1px solid var(--border)",
              }}
              onClick={() => onSwitch(conn.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: online ? "#22c55e" : "#ef4444" }}
                  />
                  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    {conn.name}
                  </span>
                </div>
                {!conn.isLocal && (
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(conn); }}
                      className="p-1 rounded hover:opacity-80"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(conn.id); }}
                      className="p-1 rounded hover:opacity-80"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
                {conn.isLocal ? "localhost (current)" : conn.url}
              </div>
              {isActive && (
                <div className="mt-2 text-xs font-medium text-blue-400">
                  ● {t("connections.active")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
