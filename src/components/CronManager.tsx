import { useEffect, useState } from "react";
import {
  Clock,
  Play,
  Pause,
  Lightning,
  CaretRight,
  ArrowsClockwise,
  CheckCircle,
  XCircle,
  Timer,
  Heartbeat,
  Gear,
  X,
} from "@phosphor-icons/react";
import {
  fetchCronJobs,
  fetchCronRuns,
  fetchSystemCrons,
  toggleCronJob,
  runCronJob,
  type CronJob,
  type CronRun,
  type SystemCron,
} from "../api";
import { useLocale } from "../hooks/useLocale";

type Tab = "user" | "system";

export function CronManager() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("user");
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [systemCrons, setSystemCrons] = useState<SystemCron[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "ok" | "error" } | null>(null);

  const showToast = (message: string, type: "ok" | "error" = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadJobs = async () => {
    try {
      const data = await fetchCronJobs();
      setJobs(data);
    } catch (e) {
      console.error("Failed to load cron jobs:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemCrons = async () => {
    try {
      const data = await fetchSystemCrons();
      setSystemCrons(data);
    } catch (e) {
      console.error("Failed to load system crons:", e);
    }
  };

  useEffect(() => {
    loadJobs();
    loadSystemCrons();
    const interval = setInterval(loadJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedJob) {
      setRuns([]);
      return;
    }
    (async () => {
      setRunsLoading(true);
      try {
        const data = await fetchCronRuns(selectedJob);
        setRuns(data);
      } catch (e) {
        console.error("Failed to load runs:", e);
      } finally {
        setRunsLoading(false);
      }
    })();
  }, [selectedJob]);

  const handleToggle = async (job: CronJob) => {
    setActionLoading(job.id);
    try {
      await toggleCronJob(job.id, !job.enabled);
      showToast(`${!job.enabled ? "✅ 已启用" : "⏸ 已禁用"} ${job.name}`);
      await loadJobs();
    } catch (e: any) {
      showToast(`❌ ${e.message || "操作失败"}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRun = async (job: CronJob) => {
    setActionLoading(`run-${job.id}`);
    try {
      const result = await runCronJob(job.id);
      if (result.success) {
        showToast(`⚡ ${job.name} 已触发运行`);
        setTimeout(loadJobs, 2000);
      } else {
        showToast(`❌ ${result.error || "运行失败"}`, "error");
      }
    } catch (e: any) {
      showToast(`❌ ${e.message || "请求失败"}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const enabledCount = jobs.filter((j) => j.enabled).length;
  const disabledCount = jobs.length - enabledCount;

  function formatRelativeTime(iso: string | null): string {
    if (!iso) return "-";
    const date = new Date(iso);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absDiff = Math.abs(diffMs);
    const isPast = diffMs < 0;

    if (absDiff < 60000) return isPast ? t("cron.justNow") : t("cron.soonLabel");
    if (absDiff < 3600000) {
      const mins = Math.floor(absDiff / 60000);
      return isPast ? `${mins}${t("cron.minAgo")}` : `${mins}${t("cron.minLater")}`;
    }
    if (absDiff < 86400000) {
      const hours = Math.floor(absDiff / 3600000);
      return isPast ? `${hours}${t("cron.hAgo")}` : `${hours}${t("cron.hLater")}`;
    }
    const days = Math.floor(absDiff / 86400000);
    return isPast ? `${days}${t("cron.dAgo")}` : `${days}${t("cron.dLater")}`;
  }

  function statusColor(status: string | null): string {
    if (!status) return "var(--text-muted)";
    if (status === "ok" || status === "completed") return "#22c55e";
    if (status === "failed" || status === "error") return "#ef4444";
    return "#eab308";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>
        <ArrowsClockwise className="w-5 h-5 animate-spin mr-2" />
        {t("cron.loading")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto relative">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out]"
          style={{
            background: toast.type === "ok" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: toast.type === "ok" ? "#22c55e" : "#ef4444",
            border: `1px solid ${toast.type === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            backdropFilter: "blur(12px)",
          }}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Clock className="w-5 h-5 text-indigo-400" />
              {t("cron.title")}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {t("cron.subtitle")}
            </p>
          </div>
          <button
            onClick={() => { loadJobs(); loadSystemCrons(); }}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
            title={t("cron.refresh")}
          >
            <ArrowsClockwise className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
          <button
            onClick={() => setTab("user")}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === "user" ? "var(--bg-hover)" : "transparent",
              color: tab === "user" ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <Clock className="w-4 h-4" />
            业务任务
            <span
              className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: tab === "user" ? "var(--link)" : "var(--bg-hover)", color: tab === "user" ? "#fff" : "var(--text-muted)" }}
            >
              {jobs.length}
            </span>
          </button>
          <button
            onClick={() => setTab("system")}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === "system" ? "var(--bg-hover)" : "transparent",
              color: tab === "system" ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <Gear className="w-4 h-4" />
            系统调度
            <span
              className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: tab === "system" ? "var(--link)" : "var(--bg-hover)", color: tab === "system" ? "#fff" : "var(--text-muted)" }}
            >
              {systemCrons.length}
            </span>
          </button>
        </div>

        {tab === "user" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-lg p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{jobs.length}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("cron.total")}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="text-2xl font-bold text-green-400">{enabledCount}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("cron.enabled")}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--text-muted)" }}>{disabledCount}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{t("cron.disabled")}</div>
              </div>
            </div>

            {/* Job List */}
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg transition-colors"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: job.enabled ? "#22c55e" : "var(--text-muted)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {job.name}
                        </span>
                        <code
                          className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                        >
                          {job.schedule}
                        </code>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {job.lastRun && (
                          <span className="flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: statusColor(job.lastStatus) }}
                            />
                            {formatRelativeTime(job.lastRun)}
                          </span>
                        )}
                        {job.nextRun && job.enabled && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatRelativeTime(job.nextRun)}
                          </span>
                        )}
                        <span>{job.sessionTarget}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggle(job)}
                        disabled={actionLoading === job.id}
                        className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                        style={{ color: actionLoading === job.id ? "var(--text-muted)" : job.enabled ? "#eab308" : "#22c55e" }}
                        title={job.enabled ? t("cron.disable") : t("cron.enable")}
                      >
                        {actionLoading === job.id ? (
                          <ArrowsClockwise className="w-4 h-4 animate-spin" />
                        ) : job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRun(job)}
                        disabled={actionLoading === `run-${job.id}`}
                        className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                        style={{ color: actionLoading === `run-${job.id}` ? "var(--text-muted)" : "var(--link)" }}
                        title={t("cron.runNow")}
                      >
                        {actionLoading === `run-${job.id}` ? (
                          <ArrowsClockwise className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lightning className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                        className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                        style={{ color: selectedJob === job.id ? "var(--link)" : "var(--text-muted)" }}
                        title={t("cron.history")}
                      >
                        <CaretRight
                          className="w-4 h-4 transition-transform"
                          style={{ transform: selectedJob === job.id ? "rotate(90deg)" : undefined }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Run History */}
                  {selectedJob === job.id && (
                    <div className="px-4 pb-3 border-t" style={{ borderColor: "var(--border)" }}>
                      <div className="pt-3 text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                        {t("cron.runHistory")}
                      </div>
                      {runsLoading ? (
                        <div className="flex items-center gap-2 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          <ArrowsClockwise className="w-3 h-3 animate-spin" />
                          {t("cron.loading")}
                        </div>
                      ) : runs.length === 0 ? (
                        <div className="py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          {t("cron.noRuns")}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {runs.map((run, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between py-1.5 px-2 rounded"
                              style={{ background: "var(--bg-hover)" }}
                            >
                              <div className="flex items-center gap-2">
                                {run.status === "completed" || run.status === "ok" ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                ) : run.status === "failed" || run.status === "error" ? (
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-yellow-400" />
                                )}
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  {run.status || "unknown"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {run.durationMs != null && <span>{(run.durationMs / 1000).toFixed(1)}s</span>}
                                <span>
                                  {(() => {
                                    const ts = run.runAtMs || run.ts || run.startedAt;
                                    if (!ts) return "—";
                                    const d = new Date(typeof ts === "number" ? ts : ts);
                                    return isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    });
                                  })()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {jobs.length === 0 && (
              <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t("cron.empty")}</p>
              </div>
            )}
          </>
        )}

        {tab === "system" && (
          <div className="space-y-2">
            {systemCrons.map((sc) => (
              <div
                key={sc.id}
                className="rounded-lg"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: sc.enabled ? "#22c55e" : "var(--text-muted)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {sc.name}
                      </span>
                      <code
                        className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                      >
                        {sc.schedule}
                      </code>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {sc.description}
                    </div>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: sc.enabled ? "rgba(34,197,94,0.1)" : "var(--bg-hover)",
                      color: sc.enabled ? "#22c55e" : "var(--text-muted)",
                    }}
                  >
                    {sc.enabled ? "运行中" : "禁用"}
                  </span>
                </div>

                {/* Heartbeat agent details */}
                {sc.type === "heartbeat" && sc.agents && (
                  <div className="px-4 pb-3 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="pt-2 space-y-1">
                      {sc.agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded text-xs"
                          style={{ background: "var(--bg-hover)" }}
                        >
                          <span style={{ color: "var(--text-secondary)" }}>
                            {agent.name}
                            <span className="ml-1" style={{ color: "var(--text-muted)" }}>({agent.id})</span>
                          </span>
                          <span style={{ color: agent.enabled ? "#22c55e" : "var(--text-muted)" }}>
                            {agent.heartbeat === "disabled" ? "禁用" : agent.heartbeat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {systemCrons.length === 0 && (
              <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                <Gear className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>无法读取系统调度信息</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
