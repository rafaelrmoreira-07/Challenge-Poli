/**
 * Prefixo do site publicado (ex.: "/Challenge-Poli" no GitHub Pages). O <Link> do
 * Next já aplica o basePath; isto é para fetch() e URLs montadas à mão.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return BASE_PATH + path;
}

export function absoluteUrl(path: string): string {
  return window.location.origin + BASE_PATH + path;
}
