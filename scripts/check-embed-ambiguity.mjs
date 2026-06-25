#!/usr/bin/env node
/**
 * Dev guard: detecta embeds PostgREST ambiguos.
 *
 * Cuando una tabla tiene >1 FK hacia otra (p.ej. solicitudes_arco -> usuarios
 * via usuario_id y resuelta_por), `.select("..., usuarios(...)")` revienta en
 * runtime con "more than one relationship was found". Hay que escribir
 * `usuarios!<nombre_fk>(...)`.
 *
 * Este script:
 *  1. Mantiene una lista declarativa de pares (origen, destino) ambiguos.
 *  2. Recorre src/ buscando selects sobre la tabla origen.
 *  3. Falla si encuentra el embed `destino(` sin el calificador `!fk`.
 *
 * Mantén AMBIGUOUS_PAIRS sincronizado cuando agregues FKs nuevas (ver
 * `pg_constraint` con contype='f').
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** @type {{from: string, to: string, fks: string[]}[]} */
const AMBIGUOUS_PAIRS = [
  {
    from: "solicitudes_arco",
    to: "usuarios",
    fks: [
      "solicitudes_arco_usuario_id_fkey",
      "solicitudes_arco_resuelta_por_fkey",
    ],
  },
];

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const errors = [];

for (const pair of AMBIGUOUS_PAIRS) {
  // Match .from("solicitudes_arco") ... .select("...") block, then look for
  // an unqualified embed `usuarios(` (sin `!fk`) dentro del select.
  const fromRe = new RegExp(`\\.from\\(\\s*["'\`]${pair.from}["'\`]\\s*\\)`);
  // unqualified embed: `to(` not preceded by `!`
  const badRe = new RegExp(`(^|[^!\\w])${pair.to}\\s*\\(`);

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    if (!fromRe.test(src)) continue;

    // Examinar cada llamada .select("...") del archivo.
    const selectRe = /\.select\(\s*([`"'])([\s\S]*?)\1\s*[,)]/g;
    let m;
    while ((m = selectRe.exec(src)) !== null) {
      const body = m[2];
      if (!badRe.test(body)) continue;
      // Permitido si está calificado con alguno de los FKs conocidos
      const okRe = new RegExp(`${pair.to}!(${pair.fks.join("|")})\\s*\\(`);
      if (okRe.test(body)) continue;
      errors.push(
        `${relative(ROOT, file)}: embed ambiguo "${pair.to}(...)" en select de "${pair.from}".\n` +
          `   Usa: ${pair.to}!${pair.fks[0]}(...) o ${pair.to}!${pair.fks[1]}(...)`,
      );
    }
  }
}

if (errors.length) {
  console.error("\n❌ Embeds PostgREST ambiguos detectados:\n");
  for (const e of errors) console.error(" - " + e);
  console.error(
    `\n${errors.length} problema(s). Califica el embed con !<fk_name> y reintenta.\n`,
  );
  process.exit(1);
}

console.log("✓ Sin embeds ambiguos.");
