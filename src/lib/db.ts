import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { createSeedDb, extendWearablesToToday } from "./seed";
import type { Db } from "./types";

/**
 * Armazenamento do protótipo: um arquivo JSON local em .data/.
 * Suficiente para a demo (um paciente, uma máquina). Em produção isto vira um
 * banco com criptografia em repouso e controle de acesso por paciente.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/** Caminho de um arquivo enviado. O nome é validado por quem chama. */
export function uploadPath(name: string): string {
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name);
}

let writeQueue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return JSON.parse(await readFile(DB_FILE, "utf8")) as Db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const db = createSeedDb();
    await persist(db);
    return db;
  }
}

async function persist(db: Db) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_FILE);
}

/** Leitura para Server Components: sempre em tempo de requisição. */
export async function getDb(): Promise<Db> {
  await connection();
  return readDb();
}

/** Leitura para Route Handlers e Server Actions. */
export async function readDb(): Promise<Db> {
  await writeQueue;
  const db = await load();
  if (extendWearablesToToday(db)) {
    await updateDb((d) => {
      extendWearablesToToday(d);
    });
    return load();
  }
  return db;
}

/** Aplica uma mutação de forma serializada e grava o arquivo. */
export function updateDb<T>(mutate: (db: Db) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await load();
    const result = await mutate(db);
    await persist(db);
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

export async function resetDb(): Promise<void> {
  await updateDb((db) => {
    Object.assign(db, createSeedDb());
  });
}
