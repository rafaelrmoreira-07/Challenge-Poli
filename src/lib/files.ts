import "server-only";
import { readFile } from "node:fs/promises";
import { uploadPath } from "./db";
import type { SourceDocument } from "./types";

/** Resposta HTTP com o arquivo original de um laudo enviado. */
export async function documentResponse(doc: SourceDocument | undefined): Promise<Response> {
  if (!doc) return new Response("Documento não encontrado", { status: 404 });
  if (!doc.storedAs) return new Response("Este registro foi importado sem o arquivo original.", { status: 404 });
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(doc.storedAs)) return new Response("Inválido", { status: 400 });
  try {
    const buf = await readFile(uploadPath(doc.storedAs));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo não encontrado", { status: 404 });
  }
}
