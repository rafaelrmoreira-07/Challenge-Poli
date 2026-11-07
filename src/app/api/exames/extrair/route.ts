import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { ageFrom } from "@/lib/dates";
import { readDb, UPLOAD_DIR, uploadPath } from "@/lib/db";
import { ACCEPTED_TYPES, extractLabReport, MAX_UPLOAD_BYTES } from "@/lib/extraction";

export const maxDuration = 120;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function sniffOk(buf: Buffer, mime: string): boolean {
  if (mime === "application/pdf") return buf.subarray(0, 5).toString("latin1") === "%PDF-";
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png") return buf.subarray(1, 4).toString("latin1") === "PNG";
  if (mime === "image/webp") return buf.subarray(8, 12).toString("latin1") === "WEBP";
  return buf.subarray(4, 8).toString("latin1") === "ftyp"; // heic/heif
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envie o arquivo como multipart/form-data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number]))
    return Response.json({ error: "Formato não aceito. Envie PDF, JPG, PNG, WEBP ou HEIC." }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Arquivo maior que 10 MB." }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffOk(buf, file.type)) return Response.json({ error: "O conteúdo do arquivo não confere com o formato." }, { status: 415 });

  const uploadId = `${randomUUID()}.${EXT[file.type]}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(uploadPath(uploadId), buf);

  const db = await readDb();
  const base = { uploadId, filename: file.name.slice(0, 160), mimeType: file.type };
  try {
    const extraction = await extractLabReport(buf, file.type, {
      sex: db.patient.sex,
      age: ageFrom(db.patient.birthDate),
    });
    return Response.json({ ...base, extraction });
  } catch (err) {
    console.error("[extração] falhou:", (err as Error).message);
    return Response.json(
      { ...base, extraction: null, error: "A IA não conseguiu ler o laudo agora. Tente de novo ou preencha os resultados à mão." },
      { status: 503 },
    );
  }
}
