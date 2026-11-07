import { documentResponse } from "@/lib/files";
import { openShare } from "@/lib/share";

export async function GET(_req: Request, ctx: RouteContext<"/api/medico/[token]/documentos/[id]">) {
  const { token, id } = await ctx.params;
  const access = await openShare(token);
  if (!access.ok) return new Response("Acesso não autorizado ou expirado", { status: 403 });
  return documentResponse(access.data.documents.find((d) => d.id === id));
}
