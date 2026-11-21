"use client";

import { Bold, Italic, Link2, List, ListOrdered, Quote, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import { toPlainText } from "@/lib/rules/richtext";
import { cn } from "@/lib/utils";

const TOOLS: { command: string; label: string; icon: typeof Bold; arg?: string }[] = [
  { command: "bold", label: "加粗", icon: Bold },
  { command: "italic", label: "斜体", icon: Italic },
  { command: "underline", label: "下划线", icon: Underline },
  { command: "insertUnorderedList", label: "无序列表", icon: List },
  { command: "insertOrderedList", label: "有序列表", icon: ListOrdered },
  { command: "formatBlock", label: "引用", icon: Quote, arg: "blockquote" },
];

/**
 * 轻量富文本编辑器：contentEditable + 浏览器原生命令，
 * 输出 HTML 后在服务端统一做白名单净化，避免存储型 XSS。
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "支持加粗、列表、引用与链接…",
  maxLength = 5000,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value !== lastValue.current && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
    lastValue.current = value;
  }, [value]);

  const emit = () => {
    const html = editorRef.current?.innerHTML ?? "";
    lastValue.current = html;
    onChange(html.slice(0, maxLength));
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const createLink = () => {
    const url = window.prompt("请输入链接地址（需以 http:// 或 https:// 开头）");
    if (!url) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      window.alert("链接需以 http:// 或 https:// 开头");
      return;
    }
    exec("createLink", url.trim());
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white/70 shadow-[inset_0_0_0_1px_hsl(var(--input)/0.7)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-primary/10 px-2 py-1.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.command + (tool.arg ?? "")}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onClick={() => exec(tool.command, tool.arg)}
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
        <button
          type="button"
          title="插入链接"
          aria-label="插入链接"
          onClick={createLink}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto pr-1 text-[11px] text-muted-foreground">
          {toPlainText(value).length} / {maxLength}
        </span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className={cn(
          "min-h-[150px] px-3.5 py-3 text-sm leading-7 text-foreground outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]",
        )}
      />
    </div>
  );
}
