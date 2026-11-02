# Known Limitations, Unverified Items, Future Work

## Known Limitations (Measured or By Design)

1. **Site `:hover` backgrounds suppressed** on recoloured elements (computed background identical before/during hover; pinned by e2e). Overrides use `!important` attribute rules beating site hover rules. Non-color hover effects (cursor/transform/shadows) untouched but not individually tested.
2. **Image/gradient backgrounds left as authored** (and text too). Light gradients remain light islands. Dark hero images with light text are fine.
3. **Logos/photos never changed.** Dark transparent logos can be unreadable on dark pages — use per-site exclusion or custom CSS.
4. **Canvas/SVG charts shown on original light backdrop** so pixels stay readable — bright rectangles by design.
5. **Elevation order inverted** for light-on-light layouts: white card on light-grey page becomes slightly *darker* than page.
6. **Inline `style="… !important"` may defeat override** (inline `!important` beats stylesheet `!important`). Untested.
7. **Closed shadow roots** cannot be reached; open ones handled (jsdom-tested, real component library not e2e-tested).
8. **Unsupported pages:** `chrome://`, Web Store, `file://`, PDF viewer, extension pages, `about:blank`/`srcdoc` frames.
9. **Native-dark detection heuristic** (body/html background luminance <0.2 or `color-scheme`). Dark theme in wrapper element may be missed or themed unnecessarily (harmless: dark stays dark); use Force/Exclude.
10. **Contrast guarantees per element against effective background** — not over images/gradients, `background-clip:text`, or parser-unknown colors (left alone).
11. **Contrast floors may be unreachable on mid-tone backgrounds** (7:1 on mid-grey) — fallback to white/black (best possible).
12. **Storage read-modify-write, last write wins** when two surfaces save at same moment.
13. **Reloaded/updated extension:** already-open tabs keep orphaned old content script until reloaded.
14. **Custom CSS** can break site layout if user writes invalid selectors; validated but not sandboxed per-property.
15. **Reading mode hides:** header/nav/aside/.sidebar/[role=banner]/.ad/.ads — may hide desired content on some sites; disable per-site if needed.
16. **Schedule:** Checks every minute via `chrome.alarms`; if service worker sleeping, up to 1 min delay.
17. **Text size scaling:** `html{font-size:X%}` may affect sites using `rem` heavily; use per-site override to tune.

## Not Verified (No Evidence Gathered)

- **Any live website.** All tests use local fixtures; no universal compatibility claim.
- **Browsers other than Chromium 141** (Chrome/Edge/Brave). Firefox/Safari need separate MV3 verification — not attempted.
- **Physical Alt+Shift+D key press** (registration verified, handler unit-tested).
- **First-paint flash at document_start** (settings load async). Early-paint guard paints `<html>` dark immediately, but not measured.
- **Memory/battery/very large pages** CPU profiles. One throughput measure: 7500 nodes ~0.6–0.8s container.
- **Screen readers**, high-contrast OS, zoom/DPI, RTL, print.
- **Monaco/CodeMirror/Google-Docs, WebGL, video overlays, Shadow-DOM-heavy frameworks.**
- **`npm audit` review** (run yourself).
- **Visited link color** as painted (rule exists; Chrome restricts reading visited styles).
- **Color-blind modes** beyond accent hue adjustment (no simulated-color test).

## Future Improvements (Prioritized)

1. **Hover/active/focus-state preservation:** Parse same-origin stylesheets (and fetch cross-origin via host_permissions) to remap colors inside pseudo-class rules.
2. **Logo handling:** Heuristic or per-element "invert this image" (sampling needs same-origin pixels).
3. **Early-paint cache:** Per-origin enabled/theme cache to avoid flash, without touching page storage.
4. **Gradient remapping** for light gradients.
5. **Wildcard subdomain rules** (opt-in, documented) + per-site brightness overrides UI polishing.
6. **Firefox/Edge builds** after verifying MV3 differences.
7. **Larger real-world corpus** in CI, visual regression snapshots, axe-core + screen reader audits.
8. **Pause-on-idle** observer, per-frame opt-out for performance-sensitive apps.
9. **Import/export granularity:** Per-theme/per-site selective export.
10. **Telemetry-free usage stats** (local only, e.g., how many sites themed) for user insight — only if privacy-preserving and opt-in.
