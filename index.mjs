#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function loadInput() {
  const argPath = process.argv[2];
  const path = argPath
    ? argPath
    : fileURLToPath(new URL("./sample.json", import.meta.url));
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

function isResolved(query, layerName) {
  return query.resolved?.[layerName] === true;
}

// First layer, in pipeline order, that resolves the query. null if none does.
function firstResolver(query, layers) {
  for (const layer of layers) {
    if (isResolved(query, layer.name)) return layer.name;
  }
  return null;
}

function isolatedRecall(layers, queries) {
  const total = queries.length;
  return layers.map((layer) => {
    const hits = queries.filter((q) => isResolved(q, layer.name)).length;
    return { name: layer.name, recall: total ? hits / total : 0 };
  });
}

function trafficAbsorbed(layers, queries) {
  const total = queries.length;
  const counts = new Map(layers.map((l) => [l.name, 0]));
  let unresolved = 0;
  for (const q of queries) {
    const winner = firstResolver(q, layers);
    if (winner) counts.set(winner, counts.get(winner) + 1);
    else unresolved++;
  }
  return {
    perLayer: layers.map((l) => ({
      name: l.name,
      fraction: total ? counts.get(l.name) / total : 0,
    })),
    unresolvedFraction: total ? unresolved / total : 0,
  };
}

function resolvedFraction(layers, queries) {
  const total = queries.length;
  if (!total) return 0;
  const resolved = queries.filter((q) => firstResolver(q, layers) !== null).length;
  return resolved / total;
}

function marginalContribution(layers, queries) {
  const full = resolvedFraction(layers, queries);
  return layers.map((layer) => {
    const without = layers.filter((l) => l.name !== layer.name);
    const withoutFraction = resolvedFraction(without, queries);
    return { name: layer.name, pointsLost: full - withoutFraction };
  });
}

function pct(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function printWeakestLink(layers, queries) {
  console.log("=== 1. ESLABON DEBIL ===\n");
  const recalls = isolatedRecall(layers, queries);
  const worst = recalls.reduce((a, b) => (b.recall < a.recall ? b : a));
  for (const r of recalls) {
    const mark = r.name === worst.name ? "  <-- eslabon debil" : "";
    console.log(`  ${r.name.padEnd(20)} recall aislado: ${pct(r.recall)}${mark}`);
  }
  console.log("");
}

function printTrafficAbsorbed(layers, queries) {
  console.log("=== 2. TRAFICO ABSORBIDO ===\n");
  const { perLayer, unresolvedFraction } = trafficAbsorbed(layers, queries);
  for (const l of perLayer) {
    console.log(`  ${l.name.padEnd(20)} absorbe: ${pct(l.fraction)}`);
  }
  console.log(`  ${"no resueltas".padEnd(20)} absorbe: ${pct(unresolvedFraction)}`);
  console.log("");
}

function printMarginalContribution(layers, queries) {
  console.log("=== 3. CONTRIBUCION MARGINAL ===\n");
  const contributions = marginalContribution(layers, queries)
    .slice()
    .sort((a, b) => b.pointsLost - a.pointsLost);
  const candidate = contributions[contributions.length - 1];
  for (const c of contributions) {
    const mark = c.name === candidate.name ? "  <-- candidata a borrar" : "";
    console.log(`  ${c.name.padEnd(20)} pierde: ${pct(c.pointsLost)}${mark}`);
  }
  console.log("");
  console.log(`  recall total del pipeline: ${pct(resolvedFraction(layers, queries))}`);
}

function main() {
  const { layers, queries } = loadInput();
  printWeakestLink(layers, queries);
  printTrafficAbsorbed(layers, queries);
  printMarginalContribution(layers, queries);
}

main();
