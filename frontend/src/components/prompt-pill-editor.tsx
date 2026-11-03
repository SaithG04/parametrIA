import { useEffect, useRef, type KeyboardEvent } from "react";

export interface PromptPill {
  key: string;
  label: string;
  description: string;
}

const tokenPattern = /\{\{field:([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?)\}\}/g;

function serializePrompt(element: HTMLElement): string {
  function serializeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const token = node.dataset["promptToken"];
    if (token) return `{{field:${token}}}`;
    if (node.tagName === "BR") return "\n";
    const content = Array.from(node.childNodes, serializeNode).join("");
    return ["DIV", "P"].includes(node.tagName) && node.nextSibling ? `${content}\n` : content;
  }
  return Array.from(element.childNodes, serializeNode).join("");
}

function createPill(token: string, pills: Map<string, PromptPill>) {
  const pill = document.createElement("span");
  const metadata = pills.get(token);
  pill.className = "prompt-token";
  pill.contentEditable = "false";
  pill.dataset["promptToken"] = token;
  pill.title = metadata?.description ?? "Este campo ya no está disponible en el reporte.";
  pill.textContent = metadata?.label ?? token;
  if (!metadata) pill.dataset["invalid"] = "true";
  return pill;
}

function renderPrompt(element: HTMLElement, value: string, pills: Map<string, PromptPill>, signature: string) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of value.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const token = match[1];
    if (!token) continue;
    if (index > cursor) fragment.append(value.slice(cursor, index));
    fragment.append(createPill(token, pills));
    cursor = index + match[0].length;
  }
  if (cursor < value.length) fragment.append(value.slice(cursor));
  element.replaceChildren(fragment);
  element.dataset["promptSource"] = value;
  element.dataset["promptPills"] = signature;
}

export function PromptPillEditor({
  id,
  value,
  pills,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  pills: PromptPill[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pillMap = new Map(pills.map((pill) => [pill.key, pill]));
  const pillSignature = pills.map((pill) => `${pill.key}:${pill.label}`).join("|");

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && (editor.dataset["promptSource"] !== value || editor.dataset["promptPills"] !== pillSignature)) {
      renderPrompt(editor, value, pillMap, pillSignature);
    }
  }, [value, pillMap, pillSignature]);

  function updatePrompt(editor: HTMLElement) {
    const nextValue = serializePrompt(editor);
    editor.dataset["promptSource"] = nextValue;
    onChange(nextValue);
  }

  function insertToken(token: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const preserveCaret = document.activeElement === editor;
    editor.focus();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : document.createRange();
    if (!preserveCaret || !editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const pill = createPill(token, pillMap);
    const spacer = document.createTextNode(" ");
    const insertion = document.createDocumentFragment();
    insertion.append(pill, spacer);
    range.insertNode(insertion);
    range.setStartAfter(spacer);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    updatePrompt(editor);
  }

  function removeAdjacentPill(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const { startContainer, startOffset } = range;
    const isBackspace = event.key === "Backspace";
    let adjacent: Node | null = null;
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const length = startContainer.textContent?.length ?? 0;
      if ((isBackspace && startOffset === 0) || (!isBackspace && startOffset === length)) {
        adjacent = isBackspace ? startContainer.previousSibling : startContainer.nextSibling;
      }
    } else {
      adjacent = startContainer.childNodes[isBackspace ? startOffset - 1 : startOffset] ?? null;
    }
    if (!(adjacent instanceof HTMLElement) || !adjacent.dataset["promptToken"]) return;
    event.preventDefault();
    adjacent.remove();
    const editor = editorRef.current;
    if (editor) updatePrompt(editor);
  }

  return <div className="grid gap-3">
    <div
      ref={editorRef}
      id={id}
      role="textbox"
      aria-label="Instrucciones de evaluación"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className="prompt-editor min-h-36 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6"
      onInput={(event) => updatePrompt(event.currentTarget)}
      onKeyDown={removeAdjacentPill}
    />
    {pills.length > 0 && <div className="grid gap-2">
      <p className="text-xs font-semibold text-slate-700">Insertar un campo del reporte</p>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => <button
          key={pill.key}
          type="button"
          className="prompt-pill-button"
          title={pill.description}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => insertToken(pill.key)}
        >
          + {pill.label}
        </button>)}
      </div>
    </div>}
  </div>;
}
