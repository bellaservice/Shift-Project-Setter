// scripts/check-bundle-secrets.mjs
// Fails if SUPABASE_SERVICE_ROLE_KEY appears anywhere in the client bundle.
// Run after `npm run build`:  node scripts/check-bundle-secrets.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENV_FILE = ".env.local";
const SCAN_DIRS = [".next/static", "public"];

function readEnv(file) {
  if (!existsSync(file)) {
    console.error(`FAIL: ${file} not found — cannot verify.`);
    process.exit(1);
  }
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function walk(dir, onFile) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

const env = readEnv(ENV_FILE);
const secret = env.SUPABASE_SERVICE_ROLE_KEY;

if (!secret) {
  console.error("FAIL: SUPABASE_SERVICE_ROLE_KEY is empty in .env.local.");
  process.exit(1);
}
for (const name of Object.keys(env)) {
  if (name.startsWith("NEXT_PUBLIC_") && name.includes("SERVICE_ROLE")) {
    console.error(`FAIL: ${name} is NEXT_PUBLIC_ prefixed. Rotate the key and remove the prefix.`);
    process.exit(1);
  }
}

let leaks = 0;
for (const dir of SCAN_DIRS) {
  walk(dir, (file) => {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      return; // binary asset
    }
    if (text.includes(secret)) {
      leaks++;
      console.error(`LEAK: ${file}`);
    }
  });
}

if (leaks > 0) {
  console.error(`FAIL: service role key found in ${leaks} client asset(s). Rotate the key now.`);
  process.exit(1);
}
console.log("OK: service role key absent from all client assets.");
