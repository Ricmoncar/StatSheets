'use strict';
const fs = require('fs');

const FILE = 'C:/Users/ivy/Downloads/statsheets/script.js';

// ── Guide comment that replaces the old short TRAITS comment ─────────────────
const GUIDE = `// ============================================================
// HOW TO ADD A NEW TRAIT
// ============================================================
//
// Quick template — paste inside the TRAITS object and fill in the fields:
//
//   traitKey: {
//     name: 'Display Name',    // text shown on the trait chip in the UI
//     rarity: 'common',        // controls chip color — see RARITIES below
//     desc: 'What it does.',   // short description shown on the chip / hover
//     passive: [],             // stat modifiers — always include, even if empty
//
//     // ── optional fields ──
//     notes: 'DM note.',       // extra note shown in the stat panel (no UI chip)
//     situational: [...],      // in-fight toggle buttons — see SITUATIONAL below
//     cultivation: {...},      // permanent stackable counter — see CULTIVATION
//     heavenly:   {...},       // duality traits only — heavenly form data
//     hellforged: {...},       // duality traits only — hellforged form data
//   },
//
// ── RARITIES ─────────────────────────────────────────────────────────────────
//   'common'     gray chip
//   'rare'       blue chip
//   'epic'       light purple chip
//   'legendary'  yellow / gold chip
//   'mythic'     orange / red gradient chip
//   'hexxed'     dark purple / black chip  (almost never rolled normally)
//   'duality'    split chip — requires both heavenly:{} and hellforged:{} blocks
//   'determined' special evolving heartbeat chip
//
// ── PASSIVE FORMAT ────────────────────────────────────────────────────────────
//   passive: [{ stat: 'atk', op: 'pct', value: 20 }]
//
//   op:
//     'add'  flat addition     (use for substats and flat HP/ATK/etc. numbers)
//     'pct'  % boost on a main stat   (+20% ATK → op:'pct', value:20)
//     'mul'  total multiplier         (x2 ATK → op:'mul', value:2)
//
//   main stat keys:
//     'hp'  'atk'  'def'  'mag'  'spd'
//     'all_main'   (targets HP + ATK + DEF + MAG + SPD together)
//
//   substat keys  (always use op:'add' for these):
//     'crit_rate'    'crit_dmg'     'lifesteal'    'heal_pow'
//     'true_dmg'     'cooldown_red' 'dexterity'    'resilience'
//     'status_res'   'all_sub'      (targets every substat at once)
//
//   derived passive — scales from another stat:
//     { op:'derived', stat:'atk', from:'hp', per:50, perValue:1, cap:200 }
//     → +1 ATK for every 50 HP, capped at +200 ATK.
//     Use perPct instead of perValue for percentage scaling.
//     cap is optional.
//
// ── SITUATIONAL (in-fight toggle buttons) ─────────────────────────────────────
//   situational: [
//     {
//       id:      'unique-key',           // MUST be unique across ALL traits
//       label:   'Button label',         // text on the toggle button
//       desc:    'Optional tooltip.',    // optional — shows on hover
//       passive: [{ stat:'atk', op:'pct', value:20 }],
//     },
//   ]
//   Multiple situational entries = multiple independent toggle buttons.
//
// ── CULTIVATION (permanent stackable counter) ─────────────────────────────────
//   cultivation: {
//     label:         'Kills',            // shown next to the +/- counter
//     perStack:      [{ stat:'crit_rate', op:'add', value:1 }],
//                    // passive array applied PER STACK (or a single object)
//     defaultStacks: 0,                  // stacks shown in UI on load
//     maxStacks:     500,                // UI enforces this cap
//   }
//
// ── DUALITY FORMAT ────────────────────────────────────────────────────────────
//   rarity: 'duality',
//   name: 'Default Name',  desc: 'Pre-choice description.',  passive: [...],
//   heavenly:   { name: 'Heavenly Name',   desc: '...', passive: [...] },
//   hellforged: { name: 'Hellforged Name', desc: '...', passive: [...] },
//   // situational: [...] is optional and shared between both sides
//
// ── NOTES ─────────────────────────────────────────────────────────────────────
//   notes:  shown in small text below the stat panel — use for DM rulings,
//           per-hit or per-kill mechanics, things that don't have a direct
//           stat value, or anything that needs a longer explanation.
//
// ============================================================
`;

// ── Field parser: extract top-level key/value pairs from an object body ───────
// body = everything INSIDE the outer { } of a trait (the braces themselves are
// NOT included). Handles nested { } [ ] ( ) and quoted strings safely.
function parseFields(body) {
  const fields = [];
  let i = 0;
  const n = body.length;

  while (i < n) {
    // Skip whitespace and separating commas from the previous field
    while (i < n && (body[i] === ' ' || body[i] === '\t' || body[i] === '\n' || body[i] === '\r' || body[i] === ',')) i++;
    if (i >= n) break;

    // Read the key (everything up to the first ':')
    const keyStart = i;
    while (i < n && body[i] !== ':') i++;
    const key = body.slice(keyStart, i).trim();
    i++; // skip ':'

    // Skip spaces immediately after ':'
    while (i < n && (body[i] === ' ' || body[i] === '\t')) i++;

    // Read value — tracks bracket depth and string contents
    const valueStart = i;
    let depth = 0;
    let inStr = false;
    let strCh = '';

    while (i < n) {
      const c = body[i];
      if (inStr) {
        if (c === '\\') { i += 2; continue; } // skip escape sequence
        if (c === strCh) inStr = false;
        i++;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { inStr = true; strCh = c; i++; continue; }
      if (c === '{' || c === '[' || c === '(') { depth++; i++; continue; }
      if (c === '}' || c === ']' || c === ')') {
        if (depth === 0) break; // escaped the body — safety guard
        depth--;
        i++;
        continue;
      }
      if (c === ',' && depth === 0) { i++; break; } // field separator
      i++;
    }

    const raw = body.slice(valueStart, i);
    const value = raw.replace(/,\s*$/, '').trim();
    if (key) fields.push({ key, value });
  }

  return fields;
}

// ── Expand a single-line trait entry to multi-line ───────────────────────────
function expandTrait(line) {
  // Matches:   <indent><key>   :   {<body>},
  const m = line.match(/^(\s*)([A-Za-z_]\w*)\s*:\s*\{([\s\S]*)\},?\s*$/);
  if (!m) return [line]; // can't parse — return original

  const indent = m[1]; // e.g. '  '
  const key    = m[2]; // e.g. 'favored'
  const body   = m[3]; // everything between { and }

  const fields = parseFields(body);
  if (fields.length === 0) return [line];

  const inner = indent + '  '; // one extra level of indentation
  const out = [`${indent}${key}: {`];

  // name + rarity always go on the same line
  const nameFld   = fields.find(f => f.key === 'name');
  const rarityFld = fields.find(f => f.key === 'rarity');
  if (nameFld && rarityFld) {
    out.push(`${inner}name: ${nameFld.value}, rarity: ${rarityFld.value},`);
  } else if (nameFld) {
    out.push(`${inner}name: ${nameFld.value},`);
  }

  // desc
  const descFld = fields.find(f => f.key === 'desc');
  if (descFld) out.push(`${inner}desc: ${descFld.value},`);

  // passive
  const passiveFld = fields.find(f => f.key === 'passive');
  if (passiveFld) out.push(`${inner}passive: ${passiveFld.value},`);

  // all remaining fields in their original order (notes, situational, cultivation, etc.)
  const done = new Set(['name', 'rarity', 'desc', 'passive']);
  for (const f of fields) {
    if (done.has(f.key)) continue;
    out.push(`${inner}${f.key}: ${f.value},`);
  }

  out.push(`${indent}},`);
  return out;
}

// ── Reformat the body of the TRAITS object ────────────────────────────────────
// body = content between 'const TRAITS = {' and the matching closing '}'
function reformatBody(body) {
  const lines = body.split('\n');
  const out = [];
  let i = 0;
  let prevBlankOrComment = true; // avoid leading blank line

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Blank lines: collapse runs to a single blank (allow one at the very start)
    if (trimmed === '') {
      if (out.length === 0 || out[out.length - 1] !== '') out.push('');
      prevBlankOrComment = true;
      i++;
      continue;
    }

    // Section comment headers — keep, ensure blank line before
    if (trimmed.startsWith('//')) {
      if (!prevBlankOrComment) out.push('');
      out.push(line);
      prevBlankOrComment = true;
      i++;
      continue;
    }

    // If it doesn't look like a trait key, pass through unchanged
    if (!/^\s*[A-Za-z_]\w*\s*:/.test(line)) {
      out.push(line);
      prevBlankOrComment = false;
      i++;
      continue;
    }

    // Collect all lines of this trait entry using bracket depth counting
    let depth = 0;
    let inStr = false;
    let strCh = '';
    let traitEnd = i;
    let found = false;

    for (let j = i; j < lines.length && !found; j++) {
      const l = lines[j];
      for (let ci = 0; ci < l.length; ci++) {
        const c = l[ci];
        if (inStr) {
          if (c === '\\') { ci++; continue; }
          if (c === strCh) inStr = false;
          continue;
        }
        if (c === "'" || c === '"' || c === '`') { inStr = true; strCh = c; continue; }
        if (c === '{' || c === '[' || c === '(') { depth++; continue; }
        if (c === '}' || c === ']' || c === ')') {
          depth--;
          if (depth === 0) { traitEnd = j; found = true; break; }
        }
      }
    }

    const traitLines = lines.slice(i, traitEnd + 1);
    i = traitEnd + 1;

    // Ensure a blank line before each trait entry
    if (!prevBlankOrComment) out.push('');

    if (traitLines.length === 1) {
      // Single-line entry → expand to multi-line
      out.push(...expandTrait(traitLines[0]));
    } else {
      // Already multi-line → keep as-is
      out.push(...traitLines);
    }

    prevBlankOrComment = false;
  }

  return out.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
let content = fs.readFileSync(FILE, 'utf8');
// Normalise line endings to LF for processing; we'll restore CRLF at the end
const hadCRLF = content.includes('\r\n');
if (hadCRLF) content = content.replace(/\r\n/g, '\n');

// Find the old TRAITS comment block — use a fragment robust to CRLF vs LF
const oldCommentIdx = content.indexOf('// TRAITS SYSTEM');
if (oldCommentIdx === -1) throw new Error('Could not find TRAITS SYSTEM comment in file');
// Back up to include the preceding === line
const prevLineStart = content.lastIndexOf('\n', oldCommentIdx - 1);
const actualStart = prevLineStart === -1 ? oldCommentIdx : prevLineStart + 1;

// Find the 'const TRAITS = {' declaration
const TRAITS_DECL = 'const TRAITS = {';
const traitsDeclIdx = content.indexOf(TRAITS_DECL, oldCommentIdx);
if (traitsDeclIdx === -1) throw new Error('Could not find "const TRAITS = {" in file');

// Walk forward from '{' to find the matching closing '}'
// depth starts at 1 because TRAITS_DECL already opened one '{'
let depth = 1;
let inStr = false;
let strCh = '';
let k = traitsDeclIdx + TRAITS_DECL.length;

while (k < content.length && depth > 0) {
  const c = content[k];
  if (inStr) {
    if (c === '\\') { k += 2; continue; }
    if (c === strCh) inStr = false;
    k++;
    continue;
  }
  if (c === "'" || c === '"' || c === '`') { inStr = true; strCh = c; k++; continue; }
  if (c === '{' || c === '[' || c === '(') { depth++; k++; continue; }
  if (c === '}' || c === ']' || c === ')') {
    depth--;
    if (depth === 0) break; // found the closing }
    k++;
    continue;
  }
  k++;
}
// k points to the closing } of const TRAITS = { ... }

const traitsBody     = content.slice(traitsDeclIdx + TRAITS_DECL.length, k);
const reformattedBody = reformatBody(traitsBody);

const before = content.slice(0, actualStart);
const after  = content.slice(k); // starts with the closing } of TRAITS

let newContent = before + GUIDE + '\n' + TRAITS_DECL + reformattedBody + after;
// Restore CRLF if the original file used it
if (hadCRLF) newContent = newContent.replace(/\n/g, '\r\n');

fs.writeFileSync(FILE, newContent, 'utf8');

// Quick sanity check: count traits
const originalCount = (content.match(/^\s+[A-Za-z_]\w*\s*:\s*\{/gm) || []).length;
const newCount      = (newContent.match(/^\s+[A-Za-z_]\w*\s*:\s*\{/gm) || []).length;
console.log(`Done.`);
console.log(`Trait key lines: ${originalCount} before → ${newCount} after (should be equal)`);
console.log(`File length: ${content.length} → ${newContent.length} chars`);
