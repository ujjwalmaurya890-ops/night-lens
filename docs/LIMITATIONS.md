# Known limitations and unverified behavior

## Engine and compatibility

1. **Pseudo-state colors:** `!important` attribute rules can suppress author `:hover`, `:active`, or other pseudo-state background/color changes on recolored elements. Layout and non-color effects are otherwise left alone.
2. **Image overlays:** Non-gradient background images and descendant colors are intentionally left unchanged. This protects authored overlays but can leave light regions.
3. **Gradient contrast:** Literal gradient stops are remapped, but contrast is calculated against the effective solid/ancestor background, not every pixel/stop. Unknown color functions are preserved. Image URLs inside backgrounds are never remapped.
4. **Logos and illustrations:** Original pixels are preserved. Dark transparent logos can become difficult to see; use a site exclusion or trusted custom CSS.
5. **Canvas/SVG:** Canvas pixels and large SVG illustrations are not edited. Original light plates can remain bright by design. Closed shadow roots cannot be reached.
6. **Inline priority:** Author inline `style="… !important"` can outrank generated stylesheet `!important` rules.
7. **Unsupported pages:** Browser-internal pages, the Chrome Web Store, `file://`, PDF viewers, extension pages, and opaque `about:blank`/`srcdoc` cases are not supported.
8. **Native-dark detection is heuristic:** It uses page background luminance and `color-scheme`. Wrapper-only dark designs can be misclassified; force-on/exclude controls are the fallback.
9. **Contrast scope:** Targets apply where NightLens can determine colors and a backdrop. They do not guarantee readability over photographs, `background-clip: text`, unknown colors, all gradient points, or inaccessible closed-root content.
10. **Mid-tone contrast:** A requested 7:1 ratio can be mathematically unreachable against some mid-tones; the engine chooses the best available dark/light candidate.
11. **Elevation inversion:** Mapping white cards on light-gray pages can reverse relative elevation lightness.
12. **Cross-surface storage races:** Writes within one extension surface are serialized. Chrome storage has no cross-context transaction, so simultaneous popup/options/worker writes remain last-write-wins.
13. **Updated extension in old tabs:** Already-open tabs may retain an orphaned old content script until reloaded.
14. **Custom CSS:** Validation prevents remote-resource/obfuscation patterns but is not a layout or security sandbox. Trusted CSS can still hide content or break a page.
15. **Reading mode:** Hiding headers/navigation/asides/ad-like containers can hide desired content on some sites.
16. **Text scaling:** Root font-size changes can significantly alter `rem`-heavy layouts.
17. **SPA/history patching:** The engine wraps history methods while active. A site or another extension that replaces them afterward can change behavior; navigation events remain a fallback where the browser supplies them.
18. **Media-only compatibility:** Its 0.88 media filter is intentional and can slightly darken photographs/videos. Normal themes do not filter media.

## Verification boundaries

Unless a current test report explicitly says otherwise, the following are not claimed as verified:

- Every live website or universal site compatibility.
- Firefox, Safari, Edge, Brave, mobile browsers, or every Chromium version.
- Physical keyboard events for `Alt+Shift+D` (command registration and handler logic can be tested separately).
- Screen readers, OS high-contrast modes, RTL, print, zoom/DPI combinations, or formal WCAG conformance.
- First-paint flash timing, battery usage, memory ceilings, or CPU behavior on every large page.
- Monaco/CodeMirror/Google Docs, WebGL, complex video overlays, closed-root-heavy component systems, and every embedded third-party widget.
- Hardware brightness reduction. NightLens changes webpage rendering only.
- Battery savings from AMOLED/OLED palettes; this depends on hardware and content.
- Pixel-perfect rendering, all pseudo-states, or contrast over arbitrary images/gradients.

## Practical next improvements

1. Preserve pseudo-state colors without reading cross-origin stylesheets unsafely.
2. Add opt-in subdomain exceptions/wildcard-only controls if users need exact-only rules.
3. Add visual-regression coverage for gradients, shadows, and more real component libraries.
4. Add automated accessibility-tree checks and manual screen-reader audits.
5. Measure first-paint behavior and explore a privacy-safe early-theme cache.
6. Verify and document additional Chromium-based browsers before claiming support.
7. Expand local real-world fixtures and cross-browser CI without transmitting user page data.
