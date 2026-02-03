import { Puzzle, ExternalLink, FileText } from "lucide-react";
import type { SkillInfo } from "../api";
import { useLocale } from "../hooks/useLocale";

interface SkillsPageProps {
  skills: SkillInfo[];
  onOpenFile: (path: string) => void;
}

export function SkillsPage({ skills, onOpenFile }: SkillsPageProps) {
  const { t } = useLocale();

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Puzzle className="w-7 h-7 text-purple-400" />
            {t("skills.title") || "Skills"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("skills.description") || "Agent capabilities and extensions"}
          </p>
        </div>

        {/* Skills Grid */}
        {skills.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            {t("skills.empty") || "No skills found"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => onOpenFile(skill.path)}
                className="p-4 rounded-xl border text-left transition-all hover:shadow-md hover:border-purple-500/30 group"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                    <Puzzle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium mb-1 group-hover:text-purple-400 transition-colors truncate">
                      {skill.name}
                    </div>
                    {skill.description && (
                      <div className="text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
                        {skill.description}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
                      <FileText className="w-3 h-3" />
                      <span className="truncate">{skill.path}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
