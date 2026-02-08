import type { MarkdownTheme } from "../types";

export const mediumTheme: MarkdownTheme = {
  id: "medium",
  name: "Medium",
  styles: {
    body: 'font-family:Charter,"Bitstream Charter","Nimbus Roman No9 L",Georgia,"Times New Roman",serif;font-size:15px;line-height:1.75;color:rgba(36,36,36,1);letter-spacing:-0.003em;word-break:break-word;',
    h1: 'font-size:24px;font-weight:700;color:rgba(36,36,36,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.22;margin:1.8em 0 0.4em;letter-spacing:-0.016em;',
    h2: 'font-size:20px;font-weight:700;color:rgba(36,36,36,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.28;margin:1.6em 0 0.3em;letter-spacing:-0.012em;',
    h3: 'font-size:17px;font-weight:700;color:rgba(36,36,36,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.36;margin:1.4em 0 0.2em;',
    h4: 'font-size:15px;font-weight:700;color:rgba(36,36,36,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin:1.2em 0 0.15em;',
    p: 'margin:0.8em 0;line-height:1.75;font-size:15px;',
    a: 'color:inherit;text-decoration:underline;text-decoration-color:rgba(36,36,36,0.4);text-underline-offset:2px;',
    strong: 'font-weight:700;',
    em: 'font-style:italic;',
    blockquote: 'border-left:3px solid rgba(36,36,36,1);padding:0 0 0 18px;margin:1.2em 0;color:rgba(36,36,36,0.8);font-style:italic;font-size:16px;line-height:1.75;',
    code: 'background:rgba(0,0,0,0.05);padding:2px 5px;border-radius:3px;font-family:Menlo,Monaco,"Courier New",monospace;font-size:13px;color:rgba(36,36,36,0.9);',
    pre: 'background:#f2f2f2;padding:16px 20px;border-radius:4px;overflow-x:auto;margin:1.2em 0;',
    precode: 'font-family:Menlo,Monaco,"Courier New",monospace;font-size:13px;line-height:1.7;color:rgba(36,36,36,0.9);background:none;padding:0;',
    ul: 'padding-left:26px;margin:0.8em 0;list-style-type:disc;',
    ol: 'padding-left:26px;margin:0.8em 0;',
    li: 'margin:0.3em 0;line-height:1.75;font-size:15px;',
    table: 'border-collapse:collapse;width:100%;margin:1.5em 0;font-size:14px;',
    th: 'border:1px solid #d0d7de;padding:6px 13px;font-weight:600;text-align:left;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    td: 'border:1px solid #d0d7de;padding:6px 13px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    hr: 'border:none;text-align:center;margin:2.5em auto;width:100%;height:1px;background:rgba(36,36,36,0.15);',
    img: 'max-width:100%;height:auto;',
  },
};
