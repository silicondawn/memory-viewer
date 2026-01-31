import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, Rocket, ArrowRight } from "lucide-react";
import { useLocale } from "../hooks/useLocale";

type Step = "checking" | "confirm" | "installing" | "verifying" | "success" | "failed";

interface BootstrapWizardProps {
  name: string;
  gatewayUrl: string;
  token: string;
  mvPort: number;
  onComplete: (mvUrl: string) => void;
  onCancel: () => void;
}

function extractHost(gatewayUrl: string): string {
  try {
    return new URL(gatewayUrl).hostname;
  } catch {
    return gatewayUrl.replace(/^https?:\/\//, "").split(":")[0].split("/")[0];
  }
}

const INSTALL_PROMPT = `Please install and start the Memory Viewer server. Run these commands:

1. Clone the repo:
   cd ~ && git clone https://github.com/silicondawn/memory-viewer.git

2. Install dependencies and build:
   cd memory-viewer && npm install && npm run build

3. Start the server (replace WORKSPACE_DIR with your actual workspace path):
   PORT=8901 WORKSPACE_DIR=~/clawd node --import tsx/esm server/index.ts &

4. Verify it's running:
   curl -s http://localhost:8901/api/system

Please run these commands and confirm when the server is running.`;

export function BootstrapWizard({ name, gatewayUrl, token, mvPort, onComplete, onCancel }: BootstrapWizardProps) {
  const { t } = useLocale();
  const [step, setStep] = useState<Step>("checking");
  const [botResponse, setBotResponse] = useState("");
  const [error, setError] = useState("");

  const host = extractHost(gatewayUrl);
  const mvUrl = `http://${host}:${mvPort}`;

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch(`${mvUrl}/api/system`, { signal: AbortSignal.timeout(5000) });
      return r.ok;
    } catch {
      return false;
    }
  }, [mvUrl]);

  // Step 1: initial check
  useEffect(() => {
    if (step !== "checking") return;
    checkConnection().then((ok) => {
      if (ok) {
        onComplete(mvUrl);
        setStep("success");
      } else {
        setStep("confirm");
      }
    });
  }, [step, checkConnection, mvUrl, onComplete]);

  const doInstall = async () => {
    setStep("installing");
    setBotResponse("");
    setError("");
    try {
      const resp = await fetch("/api/gateway/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatewayUrl,
          token,
          messages: [{ role: "user", content: INSTALL_PROMPT.replace(/PORT=8901/g, `PORT=${mvPort}`) }],
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      // Read SSE stream
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);

            // Handle streaming delta or complete content
            if (parsed.choices?.[0]?.delta?.content) {
              accumulated += parsed.choices[0].delta.content;
            } else if (parsed.content) {
              accumulated = parsed.content;
            }
            setBotResponse(accumulated);
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) {
              throw e; // Re-throw actual errors
            }
          }
        }
      }

      if (accumulated) setBotResponse(accumulated);

      // Step 4: verify
      setStep("verifying");
      // Wait a bit then check
      await new Promise((r) => setTimeout(r, 3000));
      const ok = await checkConnection();
      if (ok) {
        onComplete(mvUrl);
        setStep("success");
      } else {
        // Retry a few times
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          if (await checkConnection()) {
            onComplete(mvUrl);
            setStep("success");
            return;
          }
        }
        setStep("failed");
      }
    } catch (err: any) {
      setError(err.message);
      setStep("failed");
    }
  };

  const retryVerify = async () => {
    setStep("verifying");
    await new Promise((r) => setTimeout(r, 2000));
    const ok = await checkConnection();
    if (ok) {
      onComplete(mvUrl);
      setStep("success");
    } else {
      setStep("failed");
    }
  };

  const inputStyle = { background: "var(--bg-hover)", color: "var(--text-primary)", border: "1px solid var(--border)" };

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
      <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <Rocket className="w-5 h-5 text-blue-400" /> Bootstrap: {name}
      </h3>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {mvUrl}
      </div>

      {step === "checking" && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> {t("bootstrap.checking")}
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("bootstrap.notInstalled")}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("bootstrap.installPrompt")}</p>
          <div className="flex gap-2">
            <button onClick={doInstall} className="btn-secondary text-sm flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5" /> {t("bootstrap.install")}
            </button>
            <button onClick={onCancel} className="btn-secondary text-sm">{t("connections.cancel")}</button>
          </div>
        </div>
      )}

      {step === "installing" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> {t("bootstrap.installing")}
          </div>
        </div>
      )}

      {step === "verifying" && (
        <div className="space-y-2">
          {botResponse && (
            <div className="text-xs p-3 rounded-lg max-h-48 overflow-auto whitespace-pre-wrap" style={inputStyle}>
              <div className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{t("bootstrap.botResponse")}:</div>
              {botResponse}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> {t("bootstrap.verifying")}
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 className="w-4 h-4" /> {t("bootstrap.success")}
        </div>
      )}

      {step === "failed" && (
        <div className="space-y-3">
          {botResponse && (
            <div className="text-xs p-3 rounded-lg max-h-48 overflow-auto whitespace-pre-wrap" style={inputStyle}>
              <div className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{t("bootstrap.botResponse")}:</div>
              {botResponse}
            </div>
          )}
          {error && (
            <div className="text-xs text-red-400">{t("bootstrap.error")}: {error}</div>
          )}
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("bootstrap.failed")}</div>
          <div className="flex gap-2">
            <button onClick={retryVerify} className="btn-secondary text-sm">{t("bootstrap.retry")}</button>
            <button onClick={onCancel} className="btn-secondary text-sm">{t("bootstrap.close")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
