import fs from 'node:fs';
import path from 'node:path';
import { EXIT, GateError } from './errors.js';

export const CONFIG_FILE = 'framevet.config.json';
const TOP_KEYS = ['entry', 'render', 'kane', 'compositions'];
const RENDER_KEYS = ['command'];
const KANE_KEYS = ['timeoutSec'];
const COMP_KEYS = ['frames', 'expect'];
export const MAX_FRAMES = 4;
const DEFAULT_RENDER_COMMAND = 'npx remotion render';
const DEFAULT_TIMEOUT_SEC = 360;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function loadConfig(cwd, compositionId, warn = () => {}) {
  const file = path.join(cwd, CONFIG_FILE);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    throw new GateError(
      EXIT.CONFIG,
      'config',
      `${CONFIG_FILE} not found in ${cwd} — create it, e.g. { "entry": "src/index.js", "compositions": { "MyComp": { "frames": [10], "expect": { "10": "..." } } } } (see README.md)`,
    );
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    throw new GateError(EXIT.CONFIG, 'config', `${CONFIG_FILE} is not valid JSON: ${e.message} — fix the syntax and rerun`);
  }
  if (!isPlainObject(cfg)) {
    throw new GateError(EXIT.CONFIG, 'config', `${CONFIG_FILE} must contain a JSON object at the top level`);
  }
  for (const key of Object.keys(cfg)) {
    if (!TOP_KEYS.includes(key)) warn(`unknown config key "${key}" — known keys: ${TOP_KEYS.join(', ')}`);
  }
  if (typeof cfg.entry !== 'string' || !cfg.entry.trim()) {
    throw new GateError(EXIT.CONFIG, 'config', `missing or invalid "entry" in ${CONFIG_FILE} — add "entry": "src/index.js" (path to your Remotion entry file)`);
  }
  let renderCommand = DEFAULT_RENDER_COMMAND;
  if (cfg.render !== undefined) {
    if (!isPlainObject(cfg.render)) {
      throw new GateError(EXIT.CONFIG, 'config', `"render" in ${CONFIG_FILE} must be an object like { "command": "npx remotion render" }`);
    }
    for (const key of Object.keys(cfg.render)) {
      if (!RENDER_KEYS.includes(key)) warn(`unknown key "render.${key}" — known keys: ${RENDER_KEYS.join(', ')}`);
    }
    if (cfg.render.command !== undefined) {
      if (typeof cfg.render.command !== 'string' || !cfg.render.command.trim()) {
        throw new GateError(EXIT.CONFIG, 'config', `"render.command" in ${CONFIG_FILE} must be a non-empty string`);
      }
      renderCommand = cfg.render.command;
    }
  }
  let timeoutSec = DEFAULT_TIMEOUT_SEC;
  if (cfg.kane !== undefined) {
    if (!isPlainObject(cfg.kane)) {
      throw new GateError(EXIT.CONFIG, 'config', `"kane" in ${CONFIG_FILE} must be an object like { "timeoutSec": 360 }`);
    }
    for (const key of Object.keys(cfg.kane)) {
      if (!KANE_KEYS.includes(key)) warn(`unknown key "kane.${key}" — known keys: ${KANE_KEYS.join(', ')}`);
    }
    if (cfg.kane.timeoutSec !== undefined) {
      if (typeof cfg.kane.timeoutSec !== 'number' || !Number.isFinite(cfg.kane.timeoutSec) || cfg.kane.timeoutSec <= 0) {
        throw new GateError(EXIT.CONFIG, 'config', `"kane.timeoutSec" in ${CONFIG_FILE} must be a positive number of seconds`);
      }
      timeoutSec = cfg.kane.timeoutSec;
    }
  }
  if (!isPlainObject(cfg.compositions) || Object.keys(cfg.compositions).length === 0) {
    throw new GateError(
      EXIT.CONFIG,
      'config',
      `missing or empty "compositions" in ${CONFIG_FILE} — add e.g. "compositions": { "PromoVideo": { "frames": [150, 420], "expect": { "150": "...", "420": "..." } } }`,
    );
  }
  const comp = cfg.compositions[compositionId];
  if (!isPlainObject(comp)) {
    const known = Object.keys(cfg.compositions).join(', ') || '(none)';
    throw new GateError(EXIT.CONFIG, 'config', `composition "${compositionId}" is not defined in ${CONFIG_FILE} — add it under "compositions", or use one of: ${known}`);
  }
  for (const key of Object.keys(comp)) {
    if (!COMP_KEYS.includes(key)) warn(`unknown key "compositions.${compositionId}.${key}" — known keys: ${COMP_KEYS.join(', ')}`);
  }
  if (!Array.isArray(comp.frames)) {
    throw new GateError(EXIT.CONFIG, 'config', `"frames" of composition "${compositionId}" must be a non-empty array of frame numbers, e.g. [150, 420]`);
  }
  if (comp.frames.length === 0) {
    throw new GateError(EXIT.CONFIG, 'config', `"frames" of composition "${compositionId}" must not be empty — list at least one frame (max ${MAX_FRAMES})`);
  }
  if (comp.frames.length > MAX_FRAMES) {
    throw new GateError(EXIT.CONFIG, 'config', `composition "${compositionId}" has ${comp.frames.length} frames — max ${MAX_FRAMES} per gate run`);
  }
  for (const f of comp.frames) {
    if (typeof f !== 'number' || !Number.isInteger(f) || f < 0) {
      throw new GateError(EXIT.CONFIG, 'config', `frame ${JSON.stringify(f)} in "frames" of "${compositionId}" is not a non-negative integer`);
    }
  }
  if (!isPlainObject(comp.expect)) {
    throw new GateError(EXIT.CONFIG, 'config', `"expect" of composition "${compositionId}" must be an object mapping each frame to its expectation, e.g. { "150": "all chips visible" }`);
  }
  const expect = {};
  for (const f of comp.frames) {
    const text = comp.expect[String(f)];
    if (typeof text !== 'string' || !text.trim()) {
      throw new GateError(
        EXIT.CONFIG,
        'config',
        `frame ${f} of "${compositionId}" has no expectation — add "expect": { "${f}": "what must be visible at frame ${f}" } to the composition in ${CONFIG_FILE}`,
      );
    }
    expect[String(f)] = text;
  }
  for (const key of Object.keys(comp.expect)) {
    if (!comp.frames.some((f) => String(f) === key)) {
      warn(`"expect" key "${key}" of "${compositionId}" has no matching frame in "frames" — it is ignored`);
    }
  }
  return {
    entry: cfg.entry,
    renderCommand,
    timeoutSec,
    composition: { id: compositionId, frames: [...comp.frames], expect },
  };
}
