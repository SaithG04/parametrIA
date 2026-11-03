import JSZip from "jszip";

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - remainder - 1) / 26);
  }
  return result;
}

function worksheetXml(rows: string[][]) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function decodeXml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity.toLowerCase()] ?? "";
  });
}

function xmlAttribute(attributes: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return attributes.match(new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`))?.[1];
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) throw new Error("Invalid cell reference");
  return [...letters].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export async function createStudentTemplate(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Estudiantes" sheetId="1" r:id="rId1"/><sheet name="Guía" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", worksheetXml([
    ["nombre", "correo", "aulas"],
    ["Ana Pérez", "ana@universidad.edu", "INV-401, MET-220"],
  ]));
  zip.file("xl/worksheets/sheet2.xml", worksheetXml([
    ["Guía de importación"],
    ["Columnas obligatorias: nombre, correo, aulas"],
    ["aulas: códigos de aulas que administras; sepáralos por coma."],
    ["Cada correo recibirá un enlace individual para configurar su contraseña."],
    ["Elimina la fila de ejemplo antes de subir el archivo."],
  ]));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function readStudentWorkbook(buffer: Buffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relationsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relationsXml) throw new Error("Workbook metadata is missing");
  const sheet = workbookXml.match(/<sheet\b([^>]*?)\/?>/);
  const relationshipId = sheet && xmlAttribute(sheet[1] ?? "", "r:id");
  if (!relationshipId) throw new Error("Workbook contains no worksheet");
  const relationship = [...relationsXml.matchAll(/<Relationship\b([^>]*?)\/?>/g)]
    .map((match) => match[1] ?? "")
    .find((attributes) => xmlAttribute(attributes, "Id") === relationshipId);
  const target = relationship && xmlAttribute(relationship, "Target");
  if (!target || target.startsWith("/") || target.split("/").includes("..")) {
    throw new Error("Worksheet path is invalid");
  }
  const sheetPath = `xl/${target.replace(/^\/+/, "")}`;
  const sheetXml = await zip.file(sheetPath)?.async("string");
  if (!sheetXml) throw new Error("Worksheet is missing");

  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const sharedStrings = sharedStringsXml
    ? [...sharedStringsXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
        [...(match[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((text) => decodeXml(text[1] ?? ""))
          .join(""))
    : [];
  return [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1] ?? "";
      const reference = xmlAttribute(attributes, "r");
      if (!reference) continue;
      const cellBody = cellMatch[2] ?? "";
      const type = xmlAttribute(attributes, "t");
      const value = type === "inlineStr"
        ? [...cellBody.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1] ?? "")).join("")
        : decodeXml(cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "");
      const sharedIndex = type === "s" ? Number(value) : -1;
      row[columnIndex(reference)] = type === "s" ? sharedStrings[sharedIndex] ?? "" : value;
    }
    return row;
  });
}
