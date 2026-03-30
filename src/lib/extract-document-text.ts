import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let pdfWorkerConfigured = false;

function ensurePdfWorkerSrc(): void {
  if (pdfWorkerConfigured) return;
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
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
    ensurePdfWorkerSrc();
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    void parser.destroy().catch(() => {});
    return result.text ?? "";
  }

  throw new Error(
    `Unsupported file type (“${mimeType || "unknown"}”). Use a PDF or Word document (.docx).`,
  );
}
