# Known limitations and unverified behavior

## Engine and compatibility

1. **Pseudo-state colors:** `!important` attribute rules can suppress author `:hover`, `:active`, or other pseudo-state background/color changes on recolored elements. Layout and non-color effects are otherwise left alone.
2. **Image overlays:** Non-gradient background images and descendant colors are intentionally left unchanged. This protects authored overlays but can leave light regions.
3. **Gradient contrast:** Literal gradient stops are remapped, but contrast is calculated against the effective solid/ancestor background, not every pixel/stop. Unknown color functions are preserved. Image URLs inside backgrounds are never remapped.
4. **Logos and illustrations:** Original pixels are preserved. Dark transparent logos can become difficult to see; use a site exclusion or trusted custom CSS.
5. **Canvas/SVG:** Canvas pixels and large SVG illustrations are not edited. Original light plates can remain bright by design.
5a. **Shadow DOM reach:** Only **open** shadow roots are themed. Closed roots are unreachable by design. A shadow root created with `attachShadow()` on an element that has already been processed, with no other DOM mutation around it, is picked up on the next rescan (navigation, stylesheet/window load, or any mutation in that subtree) rather than instantly. NightLens deliberately does not patch `Element.prototype.attachShadow`, because doing so runs on every page and would risk site breakage for a marginal gain.
6. **Inline priority:** Author inline `style="… !important"` can outrank generated stylesheet `!important` rules.
7. **Unsupported pages:** Browser-internal pages, the Chrome Web Store, `file://`, PDF viewers, extension pages, and opaque `about:blank`/`srcdoc` cases are not supported.
7a. **Cross-origin iframes:** each frame runs its own content script (declared with `all_frames`), so frames are themed independently. A frame the browser does not inject into (sandboxed without `allow-same-origin`, or a scheme outside `http`/`https`) cannot be themed, and the parent cannot reach into it. Same-origin frames follow the top page's site rules through `ancestorOrigins`.
7b. **Iframe rule inheritance:** per-site rules are matched against the top-level page's hostname when it can be determined, so a first-party frame inherits the page's decision. A third-party frame with an opaque origin falls back to its own hostname.
8. **Native-dark detection is heuristic:** It uses page background luminance and `color-scheme`. Wrapper-only dark designs can be misclassified; force-on/exclude controls are the fallback.
9. **Contrast scope:** Targets apply where NightLens can determine colors and a backdrop. They do not guarantee readability over photographs, `background-clip: text`, unknown colors, all gradient points, or inaccessible closed-root content.
10. **Mid-tone contrast:** A requested 7:1 ratio can be mathematically unreachable against some mid-tones; the engine chooses the best available dark/light candidate.
11. **Elevation inversion:** Mapping white cards on light-gray pages can reverse relative elevation lightness.
12. **Cross-surface storage races:** Writes within one extension surface are serialized. Chrome storage has no cross-context transaction, so simultaneous popup/options/worker writes remain last-write-wins.
13. **Updated extension in old tabs:** Already-open tabs may retain an orphaned old content script until reloaded. NightLens now detects the dead extension context, restores the page and detaches its listeners instead of throwing, but it cannot hot-swap itself into a new version — reload the tab to pick up new code.
14. **Custom CSS:** Validation prevents remote-resource/obfuscation patterns but is not a layout or security sandbox. Trusted CSS can still hide content or break a page.
15. **Reading mode:** Hiding headers/navigation/asides/ad-like containers can hide desired content on some sites.
16. **Text scaling:** Root font-size changes can significantly alter `rem`-heavy layouts.
17. **SPA/history patching:** The engine wraps history methods while active. A site or another extension that replaces them afterward can change behavior; navigation events remain a fallback where the browser supplies them.
18. **Media-only compatibility:** Its 0.88 media filter is intentional and can slightly darken photographs/videos. Normal themes do not filter media.

## Deliberately not implemented

- **Pseudo-state colour preservation** (`:hover`, `:focus`, `:active` author colours) requires either
  reading cross-origin stylesheets (blocked by the browser) or rewriting author stylesheets, which
  would break CSP-strict pages. It stays documented instead of approximated.
- **Closed shadow roots** and **`attachShadow` monkey-patching**: rejected as a trade of site
  stability for a marginal coverage gain.
- **ESLint**: not introduced in this pass; see the roadmap in
  [FINAL_ENGINEERING_REPORT.md](FINAL_ENGINEERING_REPORT.md).
- **Sync/cloud settings**: `chrome.storage.sync` is intentionally unused so settings never leave the
  device.

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

The current roadmap lives in [FINAL_ENGINEERING_REPORT.md](FINAL_ENGINEERING_REPORT.md#f-future-roadmap)
so it is maintained in one place. The highest-value items remain pseudo-state colour preservation,
automated accessibility-tree checks, visual-regression coverage, first-paint measurement, and
cross-browser verification.
