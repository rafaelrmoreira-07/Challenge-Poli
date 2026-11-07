import { openShare } from "@/lib/share";
import { getOrCreateSummary } from "@/lib/summary";

export const maxDuration = 90;

/** Resumo clínico por IA para o médico (do cache quando os dados não mudaram). */
export async function POST(_req: Request, ctx: RouteContext<"/api/medico/[token]/resumo">) {
  const { token } = await ctx.params;
  const access = await openShare(token);
  if (!access.ok) return Response.json({ error: "Acesso não autorizado ou expirado" }, { status: 403 });
  return Response.json(await getOrCreateSummary(token, access.share, access.data));
}
