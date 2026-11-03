import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">{link[1]}</a>;
    }
    return part;
  });
}

function isTableDivider(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

export function MarkdownPreview({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const getLine = (lineIndex: number) => lines[lineIndex] ?? "";
  let index = 0;

  while (index < lines.length) {
    const line = getLine(index).trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("|") && index + 1 < lines.length && isTableDivider(getLine(index + 1).trim())) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && getLine(index).trim().startsWith("|")) {
        rows.push(tableCells(getLine(index)));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50"><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-slate-200 px-3 py-2 font-semibold">{renderInline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex} className="border-b border-slate-100 px-3 py-2 align-top last:border-0">{renderInline(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(<Heading key={`heading-${index}`} className="mb-2 mt-4 font-semibold leading-snug first:mt-0">{renderInline(heading[2] ?? "")}</Heading>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      blocks.push(<blockquote key={`quote-${index}`} className="my-3 border-l-2 border-slate-300 pl-3 text-slate-600">{renderInline(line.replace(/^>\s?/, ""))}</blockquote>);
      index += 1;
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[2] ?? "");
      const List = ordered ? "ol" : "ul";
      const items: string[] = [];
      while (index < lines.length) {
        const item = getLine(index).trim().match(/^([-*+]|\d+[.)])\s+(.+)$/);
        if (!item || /^\d/.test(item[1] ?? "") !== ordered) break;
        items.push(item[2] ?? "");
        index += 1;
      }
      blocks.push(<List key={`list-${index}`} className={`my-3 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</List>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && getLine(index).trim() && !/^#{1,6}\s|^>\s?|^([-*+]|\d+[.)])\s+/.test(getLine(index).trim())) {
      paragraph.push(getLine(index).trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`} className="my-2 leading-7 text-slate-700">{paragraph.map((part) => renderInline(part)).flatMap((nodes, partIndex) => partIndex ? [" ", ...nodes] : nodes)}</p>);
  }

  return <article className="markdown-preview max-h-[34rem] overflow-auto rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 sm:p-5">{blocks}</article>;
}
