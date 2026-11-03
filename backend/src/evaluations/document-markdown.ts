import mammoth from "mammoth";

const imageReferenceMarker = "PARAMETRIAIMAGEREFERENCE";
const convertToMarkdown = (mammoth as typeof mammoth & {
  convertToMarkdown: typeof mammoth.convertToHtml;
}).convertToMarkdown;

export async function convertDocumentToMarkdown(buffer: Buffer): Promise<string> {
  const { value } = await convertToMarkdown({ buffer }, {
    convertImage: mammoth.images.imgElement(async () => ({
      src: imageReferenceMarker,
    })),
  });

  return value
    .replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${imageReferenceMarker}\\)`, "g"),
      (_match: string, altText: string) => `[IMAGEN: ${altText.trim() || "sin descripción"}]`,
    )
    .trim();
}
