"use client";

import { Button, cn, Icon } from "@cleanhub/ui";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";

import { useTenantI18n } from "@/i18n";

type ProductRichTextEditorProps = {
  "aria-invalid"?: boolean;
  id: string;
  initialValue?: string;
  maxLength: number;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
};

type EditorCommand =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "removeFormat";

function getEditorValue(editor: HTMLDivElement): string {
  return editor.textContent?.trim() ? editor.innerHTML : "";
}

const ALLOWED_EDITOR_TAGS = new Set([
  "B",
  "BR",
  "DIV",
  "EM",
  "I",
  "LI",
  "OL",
  "P",
  "STRONG",
  "U",
  "UL",
]);

function sanitizeEditorValue(value: string): string {
  const template = document.createElement("template");
  template.innerHTML = value;

  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (!ALLOWED_EDITOR_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
  }

  const container = document.createElement("div");
  container.append(template.content.cloneNode(true));

  return container.textContent?.trim() ? container.innerHTML : "";
}

export function ProductRichTextEditor({
  "aria-invalid": ariaInvalid = false,
  id,
  initialValue = "",
  maxLength,
  name,
  onChange,
  placeholder,
}: ProductRichTextEditorProps) {
  const { m } = useTenantI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef("");
  const [value, setValue] = useState("");

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const nextValue = sanitizeEditorValue(initialValue);
    editor.innerHTML = nextValue;
    lastValueRef.current = nextValue;
    setValue(nextValue);
  }, [initialValue]);

  function commitValue() {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const nextValue = getEditorValue(editor);

    if (nextValue.length > maxLength) {
      editor.innerHTML = lastValueRef.current;
      return;
    }

    lastValueRef.current = nextValue;
    setValue(nextValue);
    onChange?.(nextValue);
  }

  function runCommand(command: EditorCommand) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    commitValue();
  }

  function handleInput() {
    commitValue();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData.getData("text/plain"),
    );
    commitValue();
  }

  const controls = [
    {
      command: "bold" as const,
      icon: Bold,
      label: m.products.create.richText.bold,
    },
    {
      command: "italic" as const,
      icon: Italic,
      label: m.products.create.richText.italic,
    },
    {
      command: "underline" as const,
      icon: Underline,
      label: m.products.create.richText.underline,
    },
    {
      command: "insertUnorderedList" as const,
      icon: List,
      label: m.products.create.richText.bulletList,
    },
    {
      command: "insertOrderedList" as const,
      icon: ListOrdered,
      label: m.products.create.richText.numberedList,
    },
    {
      command: "removeFormat" as const,
      icon: RemoveFormatting,
      label: m.products.create.richText.clearFormatting,
    },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        ariaInvalid &&
          "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <div
        aria-label={m.products.create.richText.toolbarLabel}
        className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1"
        role="toolbar"
      >
        {controls.map((control, index) => (
          <Button
            aria-label={control.label}
            className={cn(index === 3 && "ml-1 border-l pl-2")}
            key={control.command}
            onClick={() => runCommand(control.command)}
            onMouseDown={(event) => event.preventDefault()}
            size="icon-sm"
            title={control.label}
            type="button"
            variant="ghost"
          >
            <Icon aria-hidden icon={control.icon} size={14} />
          </Button>
        ))}
      </div>

      <div
        aria-label={m.products.create.fields.description}
        aria-invalid={ariaInvalid}
        aria-multiline="true"
        className="min-h-36 px-3 py-2.5 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        contentEditable
        data-placeholder={placeholder}
        id={id}
        onDrop={(event) => event.preventDefault()}
        onInput={handleInput}
        onPaste={handlePaste}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
      <input name={name} type="hidden" value={value} />
    </div>
  );
}
