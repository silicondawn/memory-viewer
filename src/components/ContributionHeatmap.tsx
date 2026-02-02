import { useMemo, useState, useSyncExternalStore } from "react";
import type { DailyStats } from "../api";
import { useLocale } from "../hooks/useLocale";

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;

const COLORS_DARK = ["#1a1c2b", "#1b3a2a", "#1a5c35", "#26a641", "#39d353"];
const COLORS_LIGHT = ["#f0e8de", "#d4c4a0", "#b49555", "#92400e", "#78350f"];

function useIsDark() {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
  );
}

function getLevel(size: number, thresholds: number[]): number {
  if (size === 0) return 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (size >= thresholds[i]) return i + 1;
  }
  return 1;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface Props {
  data: DailyStats[];
  onOpenFile: (path: string) => void;
}

export function ContributionHeatmap({ data, onOpenFile }: Props) {
  const { t } = useLocale();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const isDark = useIsDark();

  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const { weeks, monthLabels, thresholds } = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) map.set(d.date, d.size);

    // Compute thresholds from non-zero sizes
    const sizes = data.map((d) => d.size).filter((s) => s > 0).sort((a, b) => a - b);
    let th = [1, 1000, 3000, 6000];
    if (sizes.length >= 4) {
      const q = (i: number) => sizes[Math.floor((i * (sizes.length - 1)) / 4)];
      th = [1, q(1), q(2), q(3)];
    }

    // Build 52 weeks ending today
    const today = new Date();
    const todayDay = today.getDay(); // 0=Sun
    // End of this week (Saturday) or today
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (52 * 7) - todayDay);

    const weeks: { date: string; size: number; dow: number }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let currentWeek: { date: string; size: number; dow: number }[] = [];
    let lastMonth = -1;

    const cursor = new Date(startDate);
    cursor.setDate(cursor.getDate() + 1); // start from next day

    while (cursor <= endDate) {
      const dow = cursor.getDay();
      const dateStr = cursor.toISOString().slice(0, 10);
      const month = cursor.getMonth();

      if (dow === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      if (month !== lastMonth) {
        monthLabels.push({ col: weeks.length, label: t(`month.${String(month + 1).padStart(2, "0")}`) });
        lastMonth = month;
      }

      currentWeek.push({ date: dateStr, size: map.get(dateStr) || 0, dow });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return { weeks, monthLabels, thresholds: th };
  }, [data, t]);

  const totalSize = data.reduce((s, d) => s + d.size, 0);
  const totalDays = data.filter((d) => d.size > 0).length;
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  const labelWidth = 28;
  const svgW = labelWidth + weeks.length * STEP + 10;
  const svgH = 7 * STEP + 28; // extra for month labels

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12, color: isDark ? "#8b949e" : "#7c6a58" }}>
        <span><strong style={{ color: isDark ? "#eeffff" : "#1c1410" }}>{totalDays}</strong> {t("heatmap.activeDays")}</span>
        <span><strong style={{ color: isDark ? "#eeffff" : "#1c1410" }}>{totalSize < 1024 * 1024 ? `${(totalSize / 1024).toFixed(1)} KB` : `${(totalSize / 1024 / 1024).toFixed(2)} MB`}</strong> {t("heatmap.total")}</span>
        {totalDays > 0 && <span>~<strong style={{ color: isDark ? "#eeffff" : "#1c1410" }}>{formatSize(Math.round(totalSize / totalDays))}</strong>{t("heatmap.perDay")}</span>}
      </div>
      <svg width={svgW} height={svgH} style={{ display: "block" }}>
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={labelWidth + m.col * STEP}
            y={10}
            fontSize={10}
            fill={isDark ? "#8b949e" : "#57606a"}
          >
            {m.label}
          </text>
        ))}
        {/* Day labels */}
        {dayLabels.map((label, i) =>
          label ? (
            <text
              key={i}
              x={0}
              y={18 + i * STEP + CELL / 2 + 3}
              fontSize={9}
              fill={isDark ? "#8b949e" : "#57606a"}
            >
              {label}
            </text>
          ) : null
        )}
        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day) => {
            const level = getLevel(day.size, thresholds);
            const x = labelWidth + wi * STEP;
            const y = 18 + day.dow * STEP;
            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill={colors[level]}
                style={{ cursor: day.size > 0 ? "pointer" : "default" }}
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect();
                  setTooltip({
                    x: rect.left + CELL / 2,
                    y: rect.top - 8,
                    text: `${day.date} · ${day.size > 0 ? formatSize(day.size) : t("heatmap.noData")}`,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => {
                  if (day.size > 0) onOpenFile(`memory/${day.date}.md`);
                }}
              />
            );
          })
        )}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          marginTop: 4,
          fontSize: 11,
          color: isDark ? "#8b949e" : "#57606a",
        }}
      >
        <span>{t("heatmap.less")}</span>
        {colors.map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: CELL,
              height: CELL,
              borderRadius: 2,
              background: c,
            }}
          />
        ))}
        <span>{t("heatmap.more")}</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            background: isDark ? "#1b1f23" : "#fff",
            color: isDark ? "#e6edf3" : "#24292f",
            border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
