# retrieval-ablation

A CLI that takes a precomputed query x layer results matrix for a cost-ordered
retrieval fallback pipeline and reports three things: which layer is the weak
link, how much traffic each layer absorbs, and how many recall points you'd
lose by removing each one.

It does not run your pipeline. It analyzes results you already produced.

## Why

In a cascade of fallback layers (parse, dictionary, fuzzy match, vector
search, LLM rescue), an end-to-end score tells you nothing about which layer
to fix. This tool takes per-layer resolved/unresolved booleans and attributes
the failure to a specific layer, and separately tells you which layer earns
its cost and which one doesn't.

## Usage

```bash
npx -y github:Gus2708/retrieval-ablation
```

Runs against the bundled `sample.json` (hardware-store domain, 5 layers, 24
queries). To use your own data:

```bash
npx -y github:Gus2708/retrieval-ablation path/to/your-matrix.json
```

## Input contract

```json
{
  "layers": [
    { "name": "measurement-parse", "cost": 0 },
    { "name": "pgvector", "cost": 0.0001 }
  ],
  "queries": [
    {
      "id": "q001",
      "text": "optional, for readability",
      "resolved": { "measurement-parse": true, "pgvector": false }
    }
  ]
}
```

- The order of `layers` **is** the pipeline order. It matters.
- `cost` is optional.
- `resolved[layer]` means: does this layer resolve this query on its own,
  without help from the others? A missing key is treated as `false`.
- The tool does not define "correct". You decide whether your criterion is
  exact match, top-k, or an LLM judge — this tool only measures pipeline
  structure.

## Output

Three sections, always in this order:

1. **Weak link** — isolated recall per layer (fraction of all queries each
   layer resolves on its own), worst one marked.
2. **Traffic absorbed** — in pipeline order, the fraction of queries where
   each layer is the *first* one to resolve it, plus unresolved.
3. **Marginal contribution** — for each layer, how many recall points the
   whole pipeline loses if that layer is removed (leave-one-out), sorted by
   impact, lowest marked as a deletion candidate. Closes with total pipeline
   recall.

## Sample output

```
=== 1. ESLABON DEBIL ===

  measurement-parse    recall aislado: 54.2%
  domain-dictionary    recall aislado: 45.8%  <-- eslabon debil
  pg_trgm              recall aislado: 58.3%
  pgvector             recall aislado: 62.5%
  llm-rescue           recall aislado: 79.2%

=== 2. TRAFICO ABSORBIDO ===

  measurement-parse    absorbe: 54.2%
  domain-dictionary    absorbe: 16.7%
  pg_trgm              absorbe: 8.3%
  pgvector             absorbe: 8.3%
  llm-rescue           absorbe: 8.3%
  no resueltas         absorbe: 4.2%

=== 3. CONTRIBUCION MARGINAL ===

  llm-rescue           pierde: 8.3%
  measurement-parse    pierde: 4.2%
  domain-dictionary    pierde: 4.2%
  pg_trgm              pierde: 4.2%
  pgvector             pierde: 4.2%  <-- candidata a borrar

  recall total del pipeline: 95.8%
```

(Real output from this repo's `sample.json`, pasted, not retyped.)

## Limitation: assumes layer independence

The simulation assumes that if layer 4 resolves a query, it resolves it
whether or not layer 2 ran before it. This holds in pure fallback chains,
where every layer attempts the *original* query.

It does **not** hold if a layer transforms the query for the ones after it
— query expansion, HyDE, rewriting. In that case the simulation is wrong,
because a downstream layer's success may depend on a transformation only
produced by running the earlier layer.

The fix doesn't require changing the input contract: since the input is
just booleans and the tool never asks where they came from, it's enough to
generate the matrix by running each layer in true isolation, against the
original query, instead of inferring it from a single end-to-end trace.

## Next steps (explicitly out of this MVP)

- Tests
- Terminal colors
- JSON/CSV output
- MCP wrapper
- Optimal layer ordering search (the same matrix already supports simulating
  any layer order and finding the cheapest one at equal recall)
- Schema validation beyond the minimum
- TypeScript, build step, dependencies

## Scope

Single file (`index.mjs`), zero dependencies, native Node only.
