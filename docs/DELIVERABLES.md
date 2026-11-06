# Deliverables

The historical release checklist has been superseded by the current, auditable documents:

- [Implementation report](IMPLEMENTATION_REPORT.md) — the ten contribution areas, changed components, verification, and remaining work.
- [Test report](TEST_REPORT.md) — commands and results from the current working tree.
- [Architecture](ARCHITECTURE.md) — actual runtime and engine design.
- [Feature/test matrix](FEATURE_TEST_MATRIX.md) — feature-to-test map.
- [Known limitations](LIMITATIONS.md) — compatibility and verification boundaries.
- [Security & Privacy](SECURITY_AND_PRIVACY.md) — permissions, storage, and input boundaries.

The production extension is generated in `dist/` by `npm run build`. The repository root `nightlens.zip` is a pre-existing packaged artifact; use a fresh build when validating source changes.
