import type { MarkdownTheme } from "./types";

const SELECTOR_MAP: Record<string, string> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  p: "p",
  a: "a",
  strong: "strong",
  em: "em",
  blockquote: "blockquote",
  code: "code",
  pre: "pre",
  precode: "pre code",
  ul: "ul",
  ol: "ol",
  li: "li",
  table: "table",
  th: "th",
  td: "td",
  hr: "hr",
  img: "img",
};

function applyInlineStyle(el: HTMLElement, styleStr: string) {
  el.setAttribute("style", styleStr);
}

export function applyThemeStyles(article: HTMLElement, theme: MarkdownTheme) {
  const styles = theme.styles;
  if (!styles) return;

  // Non-default themes are light-colored — always apply white background wrapper
  // so they look correct in both light and dark mode
  article.style.background = "#fff";
  article.style.borderRadius = "12px";
  article.style.padding = "2rem";

  // Apply body style to article
  if (styles.body) {
    const existing = article.getAttribute("style") || "";
    article.setAttribute("style", existing + styles.body);
  }

  // Apply styles per selector
  for (const [key, selector] of Object.entries(SELECTOR_MAP)) {
    const styleStr = styles[key as keyof typeof styles];
    if (!styleStr || key === "precode") continue;

    // Skip shiki-generated elements: don't touch pre/code inside .shiki-wrapper
    const elements = article.querySelectorAll(selector);
    for (const el of elements) {
      if (key === "code" && el.closest(".shiki-wrapper")) continue;
      if (key === "pre" && el.closest(".shiki-wrapper")) continue;
      applyInlineStyle(el as HTMLElement, styleStr);
    }
  }

  // Special: precode
  if (styles.precode) {
    const precodes = article.querySelectorAll("pre code");
    for (const el of precodes) {
      if (el.closest(".shiki-wrapper")) continue;
      applyInlineStyle(el as HTMLElement, styles.precode);
    }
  }

  // Special: hrContent - replace hr with styled text
  if (styles.hrContent) {
    const hrs = article.querySelectorAll("hr");
    for (const hr of hrs) {
      const p = document.createElement("p");
      p.textContent = styles.hrContent;
      if (styles.hr) applyInlineStyle(p, styles.hr);
      hr.replaceWith(p);
    }
  }
}

export function cleanInlineStyles(article: Element | null) {
  if (!article) return;
  (article as HTMLElement).removeAttribute("style");
  const all = article.querySelectorAll("*");
  for (const el of all) {
    // Don't remove styles from shiki-generated spans
    if (el.closest(".shiki-wrapper")) continue;
    (el as HTMLElement).removeAttribute("style");
  }
}
