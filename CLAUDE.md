## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Minimal Code
- Write the shortest solution that fully meets the stated requirement. YAGNI: no features, options, or config not asked for.
- Browser APIs and existing dependencies first. Add an npm package only when they would take substantially more code or be less reliable, and say why in one line.
- No new classes, abstraction layers, factories, or helper modules unless the same logic is needed in 3+ places.
- No speculative error handling for situations that can't realistically happen. Let unexpected errors throw.
- Edit existing code in place with minimal diffs. Don't refactor, rename, or reformat code outside the task.
- No boilerplate comments that restate the code. Comment only non-obvious "why".
- Don't generate tests, READMEs, or example files unless asked.
- Keep explanations short: what changed and why.

## Evidence Handling: never minimize
This is forensic tooling. If minimal code conflicts with defensibility in court, defensibility wins.
- SHA-256 hash verification before and after any read, copy, or transform of evidence. Don't add MD5 or SHA-1 unless asked (e.g., to match a legacy acquisition record).
- Never modify source evidence files.
- Chain-of-custody logging: timestamps, tool version, operator, input/output hashes.
- Validate evidence input and fail explicitly. Never silently skip or swallow errors on evidence data.
- Output must be deterministic and reproducible.
- No real case data in this repo. Samples and tests use synthetic data only.
