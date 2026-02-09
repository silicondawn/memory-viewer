import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocale } from "../hooks/useLocale";
import { ArrowLeft } from "@phosphor-icons/react";

// Bundled at build time via ?raw
import changelogRaw from "../../CHANGELOG.md?raw";

export function Changelog({ onBack }: { onBack: () => void }) {
  const { t } = useLocale();

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm mb-6 transition-colors hover:text-blue-400"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          {t("changelog.back")}
        </button>

        <article className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {changelogRaw}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
