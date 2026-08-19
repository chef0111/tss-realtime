import { existsSync, readFileSync } from 'node:fs';

export function applyEnvText(
  text: string,
  env: Record<string, string | undefined>
) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

export function loadLocalEnv(path = '.env.local') {
  if (!existsSync(path)) {
    return;
  }
  applyEnvText(readFileSync(path, 'utf8'), process.env);
}
