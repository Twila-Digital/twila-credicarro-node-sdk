#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node merge-sarif-runs.cjs <arquivo.sarif>');
  process.exit(1);
}

const sarif = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!Array.isArray(sarif.runs) || sarif.runs.length <= 1) {
  console.log(`[merge-sarif-runs] ${file} já tem ${sarif.runs?.length ?? 0} run(s), nada a fazer.`);
  process.exit(0);
}

const [first, ...rest] = sarif.runs;

const rulesById = new Map();
for (const rule of first.tool?.driver?.rules ?? []) {
  rulesById.set(rule.id, rule);
}

const results = [...(first.results ?? [])];

for (const run of rest) {
  for (const rule of run.tool?.driver?.rules ?? []) {
    if (!rulesById.has(rule.id)) rulesById.set(rule.id, rule);
  }
  results.push(...(run.results ?? []));
}

first.tool.driver.rules = [...rulesById.values()];
first.results = results;

sarif.runs = [first];

fs.writeFileSync(file, JSON.stringify(sarif));
console.log(`[merge-sarif-runs] Mescladas ${1 + rest.length} runs em 1 (${results.length} resultados) em ${file}.`);
