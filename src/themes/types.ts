export interface MarkdownTheme {
  id: string;
  name: string;
  styles?: {
    body?: string;
    h1?: string;
    h2?: string;
    h3?: string;
    h4?: string;
    p?: string;
    a?: string;
    strong?: string;
    em?: string;
    blockquote?: string;
    code?: string;
    pre?: string;
    precode?: string;
    ul?: string;
    ol?: string;
    li?: string;
    table?: string;
    th?: string;
    td?: string;
    hr?: string;
    hrContent?: string;
    img?: string;
  };
}
