import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  dark?: boolean;
}

export function MarkdownEditor({ value, onChange, onSave, dark = true }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Track if update is from external prop change
  const externalUpdate = useRef(false);

  const createView = useCallback(() => {
    if (!containerRef.current) return;
    viewRef.current?.destroy();

    const themeExtensions = dark
      ? [oneDark]
      : [syntaxHighlighting(defaultHighlightStyle)];

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        EditorView.lineWrapping,
        keymap.of([
          ...defaultKeymap,
          indentWithTab,
          { key: "Mod-s", run: () => { onSaveRef.current(); return true; } },
        ]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        ...themeExtensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !externalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
          ".cm-gutters": { borderRight: "none" },
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });
  }, [dark]);

  // Create/recreate on dark change
  useEffect(() => {
    createView();
    return () => viewRef.current?.destroy();
  }, [createView]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      externalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      externalUpdate.current = false;
    }
  }, [value]);

  // Focus on mount
  useEffect(() => {
    setTimeout(() => viewRef.current?.focus(), 50);
  }, []);

  return (
    <div
      ref={containerRef}
      className="markdown-editor-container"
      style={{ height: "100%", minHeight: "100%" }}
    />
  );
}
