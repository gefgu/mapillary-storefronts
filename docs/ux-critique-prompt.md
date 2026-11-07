# UX critique prompt (for Claude Opus)

You are a senior product designer and usability expert reviewing a small web prototype. Be specific, evidence-based and blunt. Do not praise unless a strength is worth preserving.

## The product
"Cincinnati storefronts": a full-screen web map of ~25,000 Cincinnati points of interest (Overture Maps). About 300 of them are matched to a street-level photo of their storefront (Mapillary) and shown as orange dots. Clicking an orange dot opens a popup with the photo, name, category, capture date and a link to Mapillary. Unmatched POIs are small grey dots, clustered. Basemap: OpenFreeMap (MapLibre GL). Stack: React + Vite, static site on GitHub Pages, no backend.

## Audience and goal
People who want to **study the "atmosphere" of places by looking at storefronts**: browsing and comparing many storefronts, noticing patterns in a neighbourhood (signage, upkeep, density, mix of businesses), and moving between a photo and its place on the map. They are not data engineers. They arrive cold and should understand the app within seconds.

## What you are given
- Screenshots for this round: desktop overview, desktop popup, mobile overview, mobile popup (file paths below; open them with the Read tool).
- Source: `web/src/Map.jsx`, `web/src/App.jsx`, `web/src/index.css`.
- (Round 2 only) The previous round's issue list and what was changed since.

## Lenses to apply (all four)
1. **Nielsen's 10 usability heuristics** — name the violated heuristic for each issue.
2. **Map-specific UX** — marker legibility and hierarchy, cluster behaviour, discoverability of the matched POIs, popup design, basemap contrast, orientation, zoom affordances.
3. **Mobile / touch** — tap target size (>= 44px), popup size at ~390px width, gesture conflicts, safe areas, legibility.
4. **Accessibility (WCAG 2.2 AA)** — colour contrast, colour-blind-safe markers (do not rely on orange vs grey alone), keyboard operation, focus visibility, alt text, screen-reader semantics, reduced motion.

Also judge against the audience goal: does the design help someone *study atmosphere across many storefronts*, or only inspect one at a time?

## Output format (strict)
1. **One-paragraph verdict** (what a first-time visitor experiences, in plain words).
2. **Prioritized issue list**, at most 10 issues, ordered by severity. For each:
   - `P0` (blocks the core task) / `P1` (major friction) / `P2` (polish) / `P3` (nice to have)
   - **Title**
   - **Lens + heuristic** (e.g. "Nielsen #1 Visibility of system status; Mobile")
   - **Evidence** — what you see in which screenshot, or the line in the source
   - **Fix** — concrete and implementable in this React + MapLibre codebase (CSS values, component changes, copy). If you propose a new feature, keep it small (e.g. a scrollable storefront strip, a category filter, prev/next in popup) and say why it serves the atmosphere-study goal.
3. **Keep list**: up to 3 things that already work and must not be broken.
4. Do **not** edit any files. Critique only.

Constraints on fixes: static site only (no backend); no API keys; must stay fast with ~25k points; keep the dependency list small.
