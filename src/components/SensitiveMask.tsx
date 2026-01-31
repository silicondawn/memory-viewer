import { useSensitive } from "../hooks/useSensitive";

/**
 * Patterns that match API tokens, keys, secrets, passwords, etc.
 * Each match will be blurred when sensitive mode is on.
 */
const SENSITIVE_PATTERNS = [
  // Generic API keys/tokens (long hex/alphanum strings after key-like labels)
  /(?<=(?:key|token|secret|password|apikey|api_key|api-key|bearer|authorization)\s*[:=]\s*)[A-Za-z0-9_\-./+]{16,}/gi,
  // Specific formats
  /pplx-[A-Za-z0-9]{40,}/g,                    // Perplexity
  /sk-[A-Za-z0-9_\-]{32,}/g,                    // OpenAI-style
  /re_[A-Za-z0-9_]{20,}/g,                      // Resend
  /ghp_[A-Za-z0-9]{36,}/g,                      // GitHub PAT
  /gho_[A-Za-z0-9]{36,}/g,                      // GitHub OAuth
  /xai-[A-Za-z0-9]{40,}/g,                      // xAI
  /GOCSPX-[A-Za-z0-9_\-]{20,}/g,               // Google client secret
  /AIza[A-Za-z0-9_\-]{30,}/g,                   // Google API key
  /[0-9a-f]{48,}/g,                             // Long hex strings (48+ chars, likely tokens)
  /eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]+/g,  // JWT tokens
];

/**
 * Replace sensitive substrings in text with masked spans.
 */
export function maskSensitiveText(text: string, hidden: boolean): (string | JSX.Element)[] {
  if (!hidden) return [text];

  // Collect all match ranges
  const ranges: { start: number; end: number }[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  if (ranges.length === 0) return [text];

  // Merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start <= last.end) {
      last.end = Math.max(last.end, ranges[i].end);
    } else {
      merged.push(ranges[i]);
    }
  }

  // Build result
  const result: (string | JSX.Element)[] = [];
  let pos = 0;
  for (const { start, end } of merged) {
    if (start > pos) result.push(text.slice(pos, start));
    result.push(
      <span key={start} className="sensitive-blur" title="Sensitive content hidden">
        {text.slice(start, end)}
      </span>
    );
    pos = end;
  }
  if (pos < text.length) result.push(text.slice(pos));
  return result;
}

/**
 * Wrap around inline text nodes to auto-mask sensitive content.
 */
export function SensitiveText({ children }: { children: string }) {
  const { hidden } = useSensitive();
  if (typeof children !== "string") return <>{children}</>;
  const parts = maskSensitiveText(children, hidden);
  return <>{parts}</>;
}
