// Validation of the deck config (contract 2.1). Returns the config to embed: known keys only, theme and lang resolved.
import { BuildError } from './errors.mjs';

const KEYS = ['title', 'subtitle', 'author', 'event', 'date', 'lang', 'theme', 'accent', 'transition', 'sections', 'vocabulary', 'description', 'timer', 'ambient'];
const STRINGS = ['subtitle', 'author', 'event', 'date', 'transition', 'description'];

export function parseConfig(text, line, warn) {
  const fail = (message) => {
    throw new BuildError('E_CONFIG', `line ${line}: ${message}`);
  };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    fail(`deck-config is not valid JSON (${e.message})`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('deck-config must be a JSON object');

  for (const key of Object.keys(raw)) {
    if (!KEYS.includes(key)) warn('W_CONFIG_KEY', `line ${line}: unknown config key "${key}" is ignored`);
  }
  if (typeof raw.title !== 'string' || !raw.title.trim()) fail('"title" is required and must be a non-empty string');
  for (const key of STRINGS) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') fail(`"${key}" must be a string`);
  }
  if (raw.theme !== undefined && (typeof raw.theme !== 'string' || !raw.theme)) fail('"theme" must be a non-empty string');
  if (raw.lang !== undefined && (typeof raw.lang !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(raw.lang))) {
    fail(`"lang" must be a BCP 47 tag such as "en" or "it-IT", got ${JSON.stringify(raw.lang)}`);
  }
  if (raw.accent !== undefined && (typeof raw.accent !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw.accent))) {
    fail(`"accent" must be #rgb or #rrggbb, got ${JSON.stringify(raw.accent)}`);
  }
  if (raw.timer !== undefined && (typeof raw.timer !== 'number' || !Number.isFinite(raw.timer) || raw.timer <= 0)) {
    fail('"timer" must be a positive number of minutes');
  }
  if (raw.ambient !== undefined && raw.ambient !== 'on' && raw.ambient !== 'off') fail(`"ambient" must be "on" or "off", got ${JSON.stringify(raw.ambient)}`);
  if (raw.vocabulary !== undefined) {
    const v = raw.vocabulary;
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some((s) => typeof s !== 'string')) {
      fail('"vocabulary" must be an object of strings');
    }
  }
  if (raw.sections !== undefined) {
    if (!Array.isArray(raw.sections)) fail('"sections" must be a list');
    const ids = new Set();
    raw.sections.forEach((s, i) => {
      const at = `sections[${i}]`;
      if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id) fail(`${at} needs a string "id"`);
      if (ids.has(s.id)) fail(`${at} repeats the id "${s.id}"`);
      ids.add(s.id);
      if (s.label !== undefined && typeof s.label !== 'string') fail(`${at}.label must be a string`);
      if (s.accent !== undefined && !(Number.isInteger(s.accent) && s.accent >= 1 && s.accent <= 6)) fail(`${at}.accent must be an integer from 1 to 6`);
    });
  }

  const config = {};
  for (const key of KEYS) if (raw[key] !== undefined) config[key] = raw[key];
  config.theme ??= 'space';
  config.lang ??= 'en';
  return config;
}
