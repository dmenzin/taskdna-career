# Mapper readiness

The V3 bridge provides deterministic lexical candidate retrieval with declared `topK=5`, Task threshold/margin, DWA-only fallback, and abstention. It returns candidates, selected level, similarity, diagnostic confidence, source/context, mapper/O*NET/corpus versions and hash, provenance, and a cache key containing every behavior-changing input. Context is separate and job titles never mint task identity. An optional contextual reranker interface is present but disabled by default.

This is a **software-semantics baseline, not measured mapping accuracy**. `tests/fixtures/mapper/adversarial-inputs.json` contains development inputs only. `schemas/mapper/independent-golden-set.schema.json` remains intentionally unfilled until independent annotators provide Task, DWA, alternatives, and valid-abstention truth. Fixture pass rates must never be called Top-1, Recall@K, or abstention accuracy.
