import type { MarkdownTheme } from "../types";

export const xiaoshengTheme: MarkdownTheme = {
  id: "xiaosheng",
  name: "小声读书",
  styles: {
    body: 'font-family:"FreightText Pro",Georgia,Cambria,"Times New Roman",Times,serif;font-size:16px;line-height:1.75;color:rgb(0,0,0);letter-spacing:0.16px;',
    h1: 'font-size:22px;font-weight:bold;color:rgb(0,0,0);text-align:center;line-height:1.5;margin:0.8em 8px;padding:0 1em;',
    h2: 'font-size:18px;font-weight:bold;color:rgb(0,0,0);text-align:center;line-height:1.5;margin:0.5em 8px;padding:0 1em;',
    h3: 'font-size:17px;font-weight:bold;color:rgb(0,0,0);line-height:1.5;margin:0.5em 8px;',
    h4: 'font-size:16px;font-weight:bold;color:rgb(0,0,0);line-height:1.5;margin:0.5em 8px;',
    p: 'margin:0 8px 16px;line-height:1.75;font-size:16px;letter-spacing:0.16px;color:rgba(0,0,0,0.9);',
    a: 'color:rgb(87,107,149);text-decoration:none;font-size:14px;',
    strong: 'font-weight:bold;background-color:rgb(255,218,169);font-style:italic;',
    em: 'font-style:italic;',
    blockquote: 'border-left:3px solid rgb(0,0,0);padding:0 0 0 16px;margin:1em 8px;color:rgba(0,0,0,0.7);font-size:15px;line-height:1.75;',
    code: 'background:rgba(0,0,0,0.06);padding:2px 5px;border-radius:3px;font-family:Menlo,Monaco,"Courier New",monospace;font-size:13px;color:rgba(0,0,0,0.8);',
    pre: 'background:rgba(0,0,0,0.04);padding:16px;border-radius:4px;overflow-x:auto;margin:1em 8px;',
    precode: 'font-family:Menlo,Monaco,"Courier New",monospace;font-size:13px;line-height:1.7;color:rgba(0,0,0,0.8);background:none;padding:0;',
    ul: 'padding-left:26px;margin:0 8px 16px;',
    ol: 'padding-left:26px;margin:0 8px 16px;',
    li: 'margin:4px 0;line-height:1.75;font-size:16px;letter-spacing:0.16px;',
    table: 'border-collapse:collapse;width:100%;margin:1em 0;',
    th: 'border:1px solid #ddd;padding:8px 12px;background:#f6f6f6;font-weight:bold;text-align:left;font-size:15px;',
    td: 'border:1px solid #ddd;padding:8px 12px;font-size:15px;',
    hr: 'border:none;border-top:1px solid rgba(0,0,0,0.1);margin:1.5em 8px;',
    img: 'max-width:100%;height:auto;border-radius:4px;',
  },
};
