import path from "node:path";
import { pathToFileURL } from "node:url";
import mammoth from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let pdfWorkerConfigured = false;

async function ensureDomMatrixPolyfill(): Promise<void> {
  if (typeof globalThis.DOMMatrix !== "undefined") return;
  try {
    const canvas = (await import("@napi-rs/canvas")) as unknown as {
      DOMMatrix?: unknown;
    };
    if (canvas.DOMMatrix) {
      // pdfjs sometimes expects browser-like DOMMatrix even in Node.
      // @ts-expect-error - we intentionally polyfill a DOM global.
      globalThis.DOMMatrix = canvas.DOMMatrix;
    }
  } catch {
    // If polyfill fails, pdf-parse may still work for some PDFs, but we'll let it throw later.
  }
}

function ensurePdfWorkerSrc(PDFParseCtor: unknown): void {
  if (pdfWorkerConfigured) return;
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );
  const setWorker = (PDFParseCtor as { setWorker?: (src: string) => unknown }).setWorker;
  if (typeof setWorker === "function") {
    setWorker(pathToFileURL(workerPath).href);
  }
  pdfWorkerConfigured = true;
}

export async function extractTextFromUpload(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (mimeType === DOCX_MIME || lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (mimeType === PDF_MIME || lower.endsWith(".pdf")) {
    // Avoid static import of pdf-parse, which can fail in Amplify due to missing DOM globals.
    await ensureDomMatrixPolyfill();
    const mod = await import("pdf-parse");
    const PDFParseCtor = (mod as { PDFParse?: unknown }).PDFParse;
    if (!PDFParseCtor) {
      throw new Error("pdf-parse did not export PDFParse");
    }
    ensurePdfWorkerSrc(PDFParseCtor);
    const parser = new (PDFParseCtor as any)({ data: buffer });
    const result = await parser.getText();
    void parser.destroy().catch(() => {});
    return result.text ?? "";
  }

  throw new Error(
    `Unsupported file type (“${mimeType || "unknown"}”). Use a PDF or Word document (.docx).`,
  );
}
