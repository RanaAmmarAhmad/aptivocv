import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
// Vite will emit the worker file and give us its final URL.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export class ScannedPdfError extends Error {
  base64: string;
  partialText: string;
  constructor(base64: string, partialText: string) {
    super(
      "This PDF looks scanned or image-based. Running OCR to extract the text…",
    );
    this.name = "ScannedPdfError";
    this.base64 = base64;
    this.partialText = partialText;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

function looksLikeGoodText(text: string): boolean {
  const stripped = text.replace(/\s/g, "");
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  return stripped.length >= 120 && letters >= 80;
}

export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return normalize(await file.text());
  }
  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    const cleaned = normalize(value);
    if (!looksLikeGoodText(cleaned)) {
      throw new Error(
        "Could not read enough text from this DOCX. Please paste the CV text instead.",
      );
    }
    return cleaned;
  }
  if (name.endsWith(".pdf")) {
    const buf = await file.arrayBuffer();
    let out = "";
    try {
      const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let lastY: number | null = null;
        let line = "";
        for (const it of content.items) {
          if (!("str" in it)) continue;
          const item = it as { str: string; transform?: number[] };
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
            out += line.trimEnd() + "\n";
            line = "";
          }
          line += item.str + " ";
          lastY = y;
        }
        out += line.trimEnd() + "\n\n";
      }
    } catch (err) {
      // fall through to OCR fallback below
      console.warn("pdfjs extraction failed, will try OCR", err);
    }
    const cleaned = normalize(out);
    if (looksLikeGoodText(cleaned)) return cleaned;
    // Signal caller to run server-side OCR fallback with the raw bytes.
    throw new ScannedPdfError(arrayBufferToBase64(buf), cleaned);
  }
  throw new Error("Unsupported file. Use PDF, DOCX, or TXT.");
}

function normalize(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}