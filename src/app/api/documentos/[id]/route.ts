import { readDb } from "@/lib/db";
import { documentResponse } from "@/lib/files";

// Lado do paciente. No protótipo não há login (um único paciente de demonstração).
export async function GET(_req: Request, ctx: RouteContext<"/api/documentos/[id]">) {
  const { id } = await ctx.params;
  const db = await readDb();
  return documentResponse(db.documents.find((d) => d.id === id));
}
