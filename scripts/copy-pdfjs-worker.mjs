import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(fileURLToPath(new URL("..", import.meta.url)));
const from = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dir = path.join(root, "public", "pdfjs");
const to = path.join(dir, "pdf.worker.min.mjs");

if (fs.existsSync(from)) {
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(from, to);
}
