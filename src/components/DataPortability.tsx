"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { buildBundle, downloadJson, parseBundle } from "@/lib/fhir";
import { asset } from "@/lib/paths";
import { countFhirExport, getDbSnapshot, importRecords } from "@/lib/store";
import { DownloadIcon, UploadIcon } from "./icons";

/**
 * Apêndice D: levar o histórico para outro sistema e trazer de outro,
 * no padrão FHIR R4 usado pela RNDS.
 */
export function DataPortability() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function importJson(text: string, source: string) {
    setBusy(true);
    try {
      const parsed = parseBundle(JSON.parse(text));
      const n = importRecords({ ...parsed, sourceLabel: source });
      if (!n.vaccines && !n.results) toast("Nada novo para importar", { description: "Tudo o que veio no arquivo já está no seu histórico." });
      else toast.success("Histórico importado", { description: `${n.results} resultados de exame e ${n.vaccines} vacinas novas.` });
    } catch (e) {
      toast.error("Não consegui ler o arquivo", { description: e instanceof Error ? e.message : "Formato inválido." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tile space-y-4">
      <div>
        <p className="text-[15px] font-medium">Levar para outro sistema</p>
        <p className="text-sm text-muted">Baixa exames, remédios, vacinas, consultas e alergias em FHIR R4, o padrão da Rede Nacional de Dados em Saúde.</p>
        <button
          type="button"
          className="btn-secondary mt-2 w-full"
          onClick={() => {
            const db = getDbSnapshot();
            const bundle = buildBundle(db);
            downloadJson(`elo-saude-historico-${new Date().toISOString().slice(0, 10)}.json`, bundle);
            countFhirExport();
            toast.success("Histórico baixado", { description: `${bundle.entry.length} registros em FHIR.` });
          }}
        >
          <DownloadIcon width={18} /> Baixar meu histórico (FHIR)
        </button>
      </div>
      <div className="border-t border-line pt-4">
        <p className="text-[15px] font-medium">Trazer de outro sistema</p>
        <p className="text-sm text-muted">Importa vacinas e exames de um arquivo FHIR, como o de um app ligado à RNDS. O que já existe não é duplicado.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json,application/fhir+json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await importJson(await f.text(), f.name.replace(/\.json$/i, ""));
          }}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <UploadIcon width={18} /> Escolher arquivo
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={async () => importJson(await (await fetch(asset("/exemplos/rnds-exemplo.json"))).text(), "UBS Vila Mariana (fictícia)")}
          >
            Usar exemplo
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">O exemplo é fictício e imita o formato de uma exportação da RNDS. A conexão direta com o Meu SUS Digital depende de credenciamento no Ministério da Saúde.</p>
      </div>
    </div>
  );
}
