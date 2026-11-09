# Contribution tracker

Statuses: `Pending` · `In Progress` · `Implemented` · `Tested` · `Verified` · `Blocked`

`Verified` means the listed verification actually ran on this working tree on 2026-11-09:
`npm run typecheck` (pass), `npm test` (701/701 pass), `npm run build` (pass). Browser-level
verification is marked separately because Chromium could not be installed in this environment; the
Playwright suite runs in CI.

| ID | Contribution | Status | Tests | Verification |
|---|---|---|---|---|
| 01 | Advanced dynamic website detection | Verified | `engine-hardening.test.ts` (dynamic attributes, large insertion, no reprocessing loop) | typecheck + 701 unit tests + build |
| 02 | Intelligent CSS colour mapping | Verified | `color.test.ts` (+4 new: hwb, named table, invalid values, determinism) | typecheck + unit + build |
| 03 | Intelligent website theme detection | Verified | `detect.test.ts` (9) + `engine-hardening.test.ts` (native-dark integration) | typecheck + unit + build |
| 04 | Single-page application compatibility | Verified | `engine-hardening.test.ts` (shared history patch, navigation reprocessing) | typecheck + unit + build |
| 05 | Shadow DOM and iframe compatibility | Verified (jsdom); iframe fixture in CI | `engine-hardening.test.ts` (dynamic shadow content, host removal/re-attach) | typecheck + unit + build; browser fixture unrun here |
| 06 | Advanced theme presets | Verified | `presets.test.ts` (14) + `ui-accessibility.test.tsx` (Themes tab) | typecheck + unit + build |
| 07 | Live theme preview | Verified | `ui-accessibility.test.tsx` (4 preview tests: tokens, ratios, no tab stops, live update) | typecheck + unit + build |
| 08 | Per-website theme customisation | Verified | `ui-accessibility.test.tsx` (6 override-editor tests) + existing `shared.test.ts` decision tests | typecheck + unit + build; one new browser test unrun here |
| 09 | Better popup and settings UI | Verified | `ui-accessibility.test.tsx`, `ui-contrast.test.ts`, `popup.test.tsx` | typecheck + unit + build |
| 10 | Keyboard and accessibility improvements | Verified | `ui-accessibility.test.tsx` (11) + `ui-contrast.test.ts` | typecheck + unit + build |
| 11 | Theme engine performance optimisation | Verified | `engine-hardening.test.ts` (fingerprint no-op, rect elision, canvas still measured) | typecheck + unit + build; measured via call-count assertions, not wall-clock |
| 12 | Mutation observer optimisation | Verified | `engine-hardening.test.ts` (attribute coverage, insertion completeness, quiescence) | typecheck + unit + build |
| 13 | Memory and resource management | Verified | `engine-hardening.test.ts` (stop() stops scheduling), `security.test.ts` (bounds), existing lifecycle tests | typecheck + unit + build |
| 14 | Reliable theme restoration | Verified | `engine-hardening.test.ts` (4-cycle outerHTML equality, early stop, shadow strip) | typecheck + unit + build |
| 15 | Error recovery and settings validation | Verified | `security.test.ts` (stale context, throwing subscriber, caps, dangling pointers) | typecheck + unit + build |
| 16 | Security hardening | Verified | `security.test.ts` (22) | typecheck + unit + build |
| 17 | Privacy-first architecture | Verified | `privacy.test.ts` (11 invariants) + `docs/PRIVACY.md` | typecheck + unit + build |
| 18 | Comprehensive automated testing | Verified | 606 → **701** tests, 9 → **15** files, 0 deleted | `npm test`: 701/701 pass |
| 19 | GitHub Actions CI/CD | Implemented (not executed) | Workflow validated locally with a YAML parser; job/step structure inspected | Cannot run GitHub Actions from this sandbox; first real run happens on the next push/PR |
| 20 | Professional open-source documentation | Verified | Documents reviewed against code; `privacy.test.ts` asserts `docs/PRIVACY.md` matches implementation | Markdown renders; internal links checked by inspection |

## Notes

- **No contribution was claimed without code.** Items 01–18 touch source files; 19 is a workflow
  file; 20 is documentation plus one automated document/implementation consistency check.
- **Browser (E2E) status is honest:** `npx playwright install chromium` and
  `npx playwright install --with-deps chromium` both fail in this sandbox (download host
  unreachable, no system Chromium). `npx playwright test --list` discovers 42 tests, which proves the
  suite is type-correct and complete, not that it passes.
- **Deliberately blocked/rejected work:** patching `Element.prototype.attachShadow` (site-stability
  risk), ESLint introduction (would either be a non-blocking signal or block a green build on
  pre-existing findings), and any change to the elevation-mapping inversion (documented limitation;
  changing it would alter every themed page without a way to validate visually here).
