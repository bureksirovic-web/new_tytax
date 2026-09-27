#!/usr/bin/env node
/**
 * Builds a family-profiles setup link from a JSON payload piped on stdin, so
 * it never lands in shell history or `ps` output (never pass it as an argv
 * argument). The owner's actual link is generated this way and shared in a
 * private chat, never committed (PLAN-family-profiles.md, Piece 1).
 *
 *   node scripts/setup-link.mjs < family.json
 *   node scripts/setup-link.mjs --origin https://staging.example < family.json
 *
 * Keep the payload in a file (or type it into stdin interactively): an
 * `echo '{...}' | node ...` line would put the names in shell history.
 *
 * Validation here is minimal (shape only, no catalog lookups): the app runs
 * the full strict zod schema (src/lib/setup-link/schema.ts) when the link is
 * opened, including the "is this a real preset id" check. This script only
 * catches an obviously broken payload before printing a link.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ORIGIN = 'https://tytax.opghaha.eu';
/** Same cap as `MAX_FRAGMENT_CHARS` in src/lib/setup-link/codec.ts. */
export const MAX_FRAGMENT_CHARS = 4096;
const NAME_PATTERN = /^[\p{L}\p{N} '-]{1,40}$/u;
const EXPERIENCE_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const LANGUAGES = new Set(['hr', 'en']);

export class SetupLinkError extends Error {}

function check(cond, message) {
  if (!cond) throw new SetupLinkError(message);
}

/** `--origin <url>`, default DEFAULT_ORIGIN. */
export function parseArgs(argv) {
  const idx = argv.indexOf('--origin');
  const origin = idx !== -1 ? argv[idx + 1] : undefined;
  check(idx === -1 || typeof origin === 'string', '--origin needs a value');
  return { origin: origin ?? DEFAULT_ORIGIN };
}

/** Minimal shape check (see header); throws SetupLinkError on the first problem. */
export function validate(payload) {
  check(payload !== null && typeof payload === 'object' && !Array.isArray(payload), 'payload must be a JSON object');
  check(payload.v === 1, '"v" must be 1');
  check(Array.isArray(payload.profiles), '"profiles" must be an array');
  check(payload.profiles.length >= 1 && payload.profiles.length <= 6, '"profiles" must have 1-6 entries');
  const currentYear = new Date().getFullYear();
  for (const p of payload.profiles) {
    check(p !== null && typeof p === 'object' && !Array.isArray(p), 'every profile must be an object');
    check(
      typeof p.name === 'string' && NAME_PATTERN.test(p.name.normalize('NFC')),
      `invalid profile name: ${JSON.stringify(p.name)}`,
    );
    check(typeof p.presetId === 'string' && p.presetId.length > 0, `invalid presetId for "${p.name}"`);
    if (p.birthYear !== undefined) {
      check(
        Number.isInteger(p.birthYear) && p.birthYear >= 1920 && p.birthYear <= currentYear,
        `invalid birthYear for "${p.name}"`,
      );
    }
    if (p.experienceLevel !== undefined) {
      check(EXPERIENCE_LEVELS.has(p.experienceLevel), `invalid experienceLevel for "${p.name}"`);
    }
    if (p.language !== undefined) {
      check(LANGUAGES.has(p.language), `invalid language for "${p.name}"`);
    }
  }
}

/** base64url(JSON.stringify(payload)); no padding. */
export function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function buildUrl(payload, origin) {
  const encoded = encodePayload(payload);
  const fragment = `#p=${encoded}`;
  check(fragment.length <= MAX_FRAGMENT_CHARS, `payload is too large: the link's fragment would be ${fragment.length} chars (max ${MAX_FRAGMENT_CHARS})`);
  return `${origin}/setup${fragment}`;
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const raw = readStdin().trim();
  check(raw.length > 0, "no JSON on stdin: echo '{...}' | node scripts/setup-link.mjs");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new SetupLinkError(`invalid JSON on stdin: ${error.message}`);
  }
  validate(payload);
  const { origin } = parseArgs(process.argv.slice(2));
  console.log(buildUrl(payload, origin));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`setup-link: ${error.message}`);
    process.exit(1);
  }
}
