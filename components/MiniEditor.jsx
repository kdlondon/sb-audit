"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef } from "react";

/**
 * Minimal rich text editor using Tiptap.
 * Supports bold, italic, underline, paragraphs (Enter).
 * Stores content as HTML.
 *
 * Props:
 *  - value: HTML string
 *  - onChange: (html) => void — called on every change
 *  - onBlur: (html) => void — called when editor loses focus
 *  - placeholder: string
 *  - className: string — extra classes for the wrapper
 *  - editorClassName: string — extra classes for the editor content
 *  - minimal: boolean — if true, hides toolbar (shows on focus)
 *  - dark: boolean — dark theme
 */
export default function MiniEditor({ value, onChange, onBlur, placeholder, className = "", editorClassName = "", minimal = false, dark = false }) {
  const blurRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Underline,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: `focus:outline-none ${editorClassName}`,
        "data-placeholder": placeholder || "",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
      blurRef.current = html;
    },
    onBlur: () => {
      onBlur?.(blurRef.current || editor?.getHTML() || "");
    },
  });

  // Sync external value changes
  const prevValue = useRef(value);
  useEffect(() => {
    if (editor && value !== prevValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
      prevValue.current = value;
    }
  }, [value, editor]);

  if (!editor) return null;

  const isActive = (type, attrs) => editor.isActive(type, attrs);
  const btnClass = (active) =>
    `px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
      active
        ? dark ? "bg-white/20 text-white" : "bg-[#e8e8e8] text-[#333]"
        : dark ? "text-white/40 hover:text-white/70" : "text-[#aaa] hover:text-[#666]"
    }`;

  return (
    <div className={`group/editor ${className}`}>
      {/* Toolbar — always visible for non-minimal, or visible on focus for minimal */}
      <div className={`flex gap-0.5 mb-1 ${minimal ? "opacity-0 group-focus-within/editor:opacity-100 h-0 group-focus-within/editor:h-auto overflow-hidden transition-all" : ""}`}>
        <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={btnClass(isActive("bold"))}>B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={btnClass(isActive("italic"))} style={{ fontStyle: "italic" }}>I</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} className={btnClass(isActive("underline"))} style={{ textDecoration: "underline" }}>U</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} className={btnClass(isActive("bulletList"))}>•</button>
      </div>
      <EditorContent editor={editor} />
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: ${dark ? "rgba(255,255,255,0.25)" : "#ccc"};
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror[data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: ${dark ? "rgba(255,255,255,0.25)" : "#ccc"};
          pointer-events: none;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
