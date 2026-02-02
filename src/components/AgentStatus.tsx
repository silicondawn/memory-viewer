import { useEffect, useState } from "react";
import { fetchAgentStatus, type AgentStatus } from "../api";
import { createHighlighter } from "shiki";
import { Activity, Server, Shield, Cpu, Clock, ChevronDown, ChevronRight, CheckCircle, XCircle, HeartPulse, Zap } from "lucide-react";
import { useLocale } from "../hooks/useLocale";

function StatusCard({ title, icon: Icon, children, className = "" }: any) {
  return (
    <div className={`p-5 rounded-xl border transition-all hover:shadow-md ${className}`} style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusRow({ label, value, sub }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border-muted)" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="text-right">
        <div className="font-medium" style={{ color: "var(--text-primary)" }}>{value}</div>
        {sub && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}

function TimeAgo({ date }: { date: string | number }) {
  if (!date) return <span>-</span>;
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  let text = "";
  if (diff < 60) text = `${diff}s ago`;
  else if (diff < 3600) text = `${Math.floor(diff / 60)}m ago`;
  else if (diff < 86400) text = `${Math.floor(diff / 3600)}h ago`;
  else text = `${Math.floor(diff / 86400)}d ago`;

  return <span title={d.toLocaleString()}>{text}</span>;
}

export function AgentStatusPage() {
  const [data, setData] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [html, setHtml] = useState("");
  const [configExpanded, setConfigExpanded] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    fetchAgentStatus()
      .then(d => {
        setData(d);
        setLoading(false);
        // Highlight config
        createHighlighter({
          themes: ['github-dark', 'github-light'],
          langs: ['json']
        }).then(highlighter => {
          const code = JSON.stringify(d.config, null, 2);
          const out = highlighter.codeToHtml(code, { lang: 'json', theme: 'github-dark' });
          setHtml(out);
        });
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 lg:p-10">
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg" style={{ background: "var(--bg-hover)" }} />
              <div className="h-8 w-48 rounded-lg" style={{ background: "var(--bg-hover)" }} />
            </div>
            <div className="h-4 w-32 rounded ml-11 mt-2" style={{ background: "var(--bg-hover)" }} />
          </div>

          {/* Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg" style={{ background: "var(--bg-hover)" }} />
                  <div className="h-5 w-24 rounded" style={{ background: "var(--bg-hover)" }} />
                </div>
                <div className="space-y-3">
                  <div className="h-10 rounded-lg" style={{ background: "var(--bg-hover)", opacity: 0.6 }} />
                  <div className="h-4 w-full rounded" style={{ background: "var(--bg-hover)", opacity: 0.4 }} />
                  <div className="h-4 w-3/4 rounded" style={{ background: "var(--bg-hover)", opacity: 0.4 }} />
                  <div className="h-4 w-2/3 rounded" style={{ background: "var(--bg-hover)", opacity: 0.4 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Config skeleton */}
          <div className="h-14 rounded-xl border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-400">
        {t("agent.error")}
      </div>
    );
  }

  const gw = data.gateway || {};
  // Support both flat (gw.runtime) and nested (gw.service.runtime) structures
  const runtime = gw.runtime || gw.service?.runtime || {};
  const gwInfo = gw.gateway || {};
  const isGwRunning = runtime.status === "running" || runtime.state === "active" || (runtime.pid && runtime.pid > 0);
  const hb = data.heartbeat || {};
  const checks = hb.checks || {};

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-500" />
            {t("agent.title")}
          </h1>
          <div className="flex items-center gap-3 text-sm pl-11" style={{ color: "var(--text-secondary)" }}>
            <span className="bg-white/10 px-2 py-0.5 rounded border border-white/10">v{data.config.version || "0.0.0"}</span>
            <span>{data.config.update?.channel || "stable"} {t("agent.channel")}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Gateway Card */}
          <StatusCard title={t("agent.gateway")} icon={Server}>
            <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-black/20">
              <div className={`w-3 h-3 rounded-full ${isGwRunning ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-red-500"}`} />
              <span className="font-medium text-lg">{isGwRunning ? t("agent.running") : t("agent.stopped")}</span>
              {isGwRunning && gw.gateway?.uptime && <span className="ml-auto text-xs opacity-60"><TimeAgo date={Date.now() - (gw.gateway.uptime * 1000)} /> {t("agent.uptime")}</span>}
            </div>
            <div className="space-y-1">
              <StatusRow label={t("agent.port")} value={gw.gateway?.port || data.config.gateway?.port || "-"} />
              <StatusRow label={t("agent.pid")} value={runtime.pid || "-"} />
              <StatusRow label={t("agent.mode")} value={gw.gateway?.bindMode || data.config.gateway?.mode || "-"} />
            </div>
          </StatusCard>

          {/* Models Card */}
          <StatusCard title={t("agent.models")} icon={Cpu}>
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{t("agent.primary")}</div>
              <div className="font-mono text-sm p-2 rounded bg-black/20 border border-white/5 truncate" title={data.config.agents?.defaults?.model?.primary || "default"}>
                {data.config.agents?.defaults?.model?.primary || "default"}
              </div>
            </div>
            {/* If we had more model stats they would go here */}
            <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>{t("agent.ready")}</span>
            </div>
          </StatusCard>

          {/* Heartbeat Card */}
          <StatusCard title={t("agent.heartbeat")} icon={HeartPulse}>
             <div className="flex flex-col items-center justify-center py-4">
               {hb.lastRun ? (
                 <>
                   <div className="text-4xl font-bold mb-1 text-green-400">
                     <TimeAgo date={hb.lastRun} />
                   </div>
                   <div className="text-sm opacity-60">{t("agent.lastActivity")}</div>
                 </>
               ) : (
                 <div className="text-center opacity-50">{t("agent.noHeartbeat")}</div>
               )}
             </div>
             <div className="space-y-1 mt-2">
               {Object.entries(checks).map(([k, v]) => (
                 <StatusRow key={k} label={k} value={v ? <TimeAgo date={(v as number) * 1000} /> : "-"} />
               ))}
             </div>
          </StatusCard>

        </div>

        {/* Config Section */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <button 
            onClick={() => setConfigExpanded(!configExpanded)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">{t("agent.config")}</span>
            </div>
            {configExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          
          {configExpanded && (
            <div className="p-0 border-t" style={{ borderColor: "var(--border)" }}>
              <div 
                className="p-4 overflow-x-auto text-sm font-mono"
                style={{ background: "#0d1117" }} // GitHub dark bg
                dangerouslySetInnerHTML={{ __html: html || "<pre>Loading...</pre>" }}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
