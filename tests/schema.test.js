// Static checks on section/block schemas and JSON templates, for rules Shopify
// enforces on upload but Theme Check doesn't report: schema names of at most
// 25 characters (Stage 5's first upload was silently refused over a 27-character
// block name), unique setting IDs, select defaults that exist, and template
// blocks whose type the section declares.
// usage: node tests/schema.test.js [themeRoot]
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const HEADER = /^\s*\/\*[\s\S]*?\*\//;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const schemas = {};
for (const dir of ['sections', 'blocks']) {
  for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.liquid'))) {
    const source = fs.readFileSync(path.join(root, dir, file), 'utf8');
    const m = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
    if (!m) continue;
    let schema;
    try {
      schema = JSON.parse(m[1]);
    } catch (e) {
      check(`${dir}/${file}: schema is valid JSON`, false, e.message);
      continue;
    }
    schemas[`${dir}/${file}`] = schema;
  }
}

const tooLong = [];
const duplicates = [];
const badDefaults = [];
const settingsOf = (list, where) => {
  const ids = new Set();
  for (const s of list || []) {
    if (!s.id) continue;
    if (ids.has(s.id)) duplicates.push(`${where}: ${s.id}`);
    ids.add(s.id);
    if ((s.type === 'select' || s.type === 'radio') && s.default !== undefined && !(s.options || []).some((o) => o.value === s.default)) {
      badDefaults.push(`${where}: ${s.id}=${s.default}`);
    }
  }
};
for (const [file, schema] of Object.entries(schemas)) {
  const name = (n, kind) => n && !String(n).startsWith('t:') && n.length > 25 && tooLong.push(`${file} ${kind} "${n}" (${n.length})`);
  name(schema.name, 'name');
  settingsOf(schema.settings, file);
  for (const block of schema.blocks || []) {
    name(block.name, 'block');
    settingsOf(block.settings, `${file} block ${block.type}`);
  }
  for (const preset of schema.presets || []) name(preset.name, 'preset');
}
check('schema names are at most 25 characters (Shopify refuses longer ones on upload)', tooLong.length === 0, tooLong.join('; '));
check('setting IDs are unique within each section and block', duplicates.length === 0, duplicates.join('; '));
check('select defaults are among their options', badDefaults.length === 0, badDefaults.join('; '));

const themeSettings = JSON.parse(fs.readFileSync(path.join(root, 'config/settings_schema.json'), 'utf8'));
const globalIds = new Map();
const globalDuplicates = [];
for (const group of themeSettings) for (const s of group.settings || []) {
  if (!s.id) continue;
  if (globalIds.has(s.id)) globalDuplicates.push(s.id);
  globalIds.set(s.id, group.name);
}
check('theme setting IDs are unique', globalDuplicates.length === 0, globalDuplicates.join(', '));

// Every block in a JSON template or section group is a type its section declares.
const unknown = [];
const jsonFiles = [
  ...fs.readdirSync(path.join(root, 'templates')).filter((f) => f.endsWith('.json')).map((f) => `templates/${f}`),
  ...fs.readdirSync(path.join(root, 'sections')).filter((f) => f.endsWith('.json')).map((f) => `sections/${f}`),
];
for (const file of jsonFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(HEADER, ''));
  for (const [id, section] of Object.entries(data.sections || {})) {
    if (section.type === '_blocks' || section.type.startsWith('shopify://')) continue;
    if (!fs.existsSync(path.join(root, 'sections', `${section.type}.liquid`))) {
      unknown.push(`${file} ${id}: no section "${section.type}"`);
      continue;
    }
    const schema = schemas[`sections/${section.type}.liquid`] || {};
    const types = new Set((schema.blocks || []).map((b) => b.type));
    for (const [bid, block] of Object.entries(section.blocks || {})) {
      if (block.type.startsWith('shopify://') && types.has('@app')) continue;
      if (!types.has(block.type) && !types.has('@theme')) unknown.push(`${file} ${id}/${bid}: "${block.type}"`);
    }
  }
}
check('template blocks are types their section declares', unknown.length === 0, unknown.join('; '));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
