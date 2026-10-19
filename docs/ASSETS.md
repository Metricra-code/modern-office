# Asset provenance

- Current office map: original AI-assisted illustration generated with the built-in image generation tool in this Codex session, stored locally. The app makes **no runtime image-generation or paid API requests**.
- Source: `docs/assets/office-map-source.png` (1575 × 998); browser asset: `public/office-map.webp` (about 159 KB, optimized with Sharp already bundled by Next.js).
- Art direction: orthographic 2D pixel-art coworking studio, consistent furniture scale, warm ivory floors, honey-oak desks, restrained sage/blue/terracotta details. Four functional rooms and a clear tiled corridor replace the earlier photorealistic miniature.
- Prompt summary: "Original overhead pixel-art virtual office; four desk studio, six-chair meeting table, two quiet desks, sofa and coffee corner; wide uninterrupted horizontal hallway, visible door gaps; no characters, text, brands or UI."
- Shared 900 × 570 geometry follows the room walls and office perimeter. Furniture, plants and rugs are decorative and passable, so room interiors do not obstruct movement. Unit tests check open corridors, eight-unit keyboard routes into all four rooms, room arrival points and sample positions; E2E verifies furniture traversal, wall boundaries, live movement synchronization and zoom controls.
- The superseded `docs/assets/office-floorplan-source.png` is retained only as a design-history source; it is not shipped to browsers.
- Typography: pinned Latin variable WOFF2 files in `src/styles/fonts/`: [Manrope v20](https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2) (200–800, 24,836 B) and [Urbanist v18](https://fonts.gstatic.com/s/urbanist/v18/L0x-DF02iFML4hGCyMqlbS0.woff2) (100–900, 27,752 B). Native CSS keeps the original family names, weights and `font-display: swap`; Next.js fingerprints the relative assets. Build and runtime make no Google Fonts requests, and the former Fontsource packages are no longer needed.
- Font provenance: the files come from the [official variable-font CSS API](https://developers.google.com/fonts/docs/css2). Complete OFL-1.1 notices are in `public/licenses/`, sourced from [Manrope](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt) and [Urbanist](https://raw.githubusercontent.com/google/fonts/main/ofl/urbanist/OFL.txt). Manrope preserves both the upstream 2018 notice and the downloaded binary's embedded 2019 notice. SHA-256: Manrope `a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972`; Urbanist `7981ef90c246352c7c217081b8d9337b9c95e9d17ae126bf56b0d3753d1e5ffb`.
- Icons: Lucide via `lucide-react`; the complete ISC and Feather-derived MIT notices are preserved unchanged in `public/licenses/lucide-react.txt`. Brand mark and social cover use project-native SVG geometry; social PNG is derived from the SVG.

## Market references, not copied assets

- [Gather virtual office](https://www.gather.town/virtual-office): readable spatial presence, distinct functional rooms and modest furniture detail. Gather has both Classic and 2.0; this project is not a clone of either.
- [Gather 2.0 navigation guide](https://support.help.gather.town/articles/1982412443-getting-started-guide): keep people and conversations legible; support keyboard navigation and zoom.
- [WorkAdventure official map rules](https://docs.workadventu.re/map-building/tiled-editor/wa-maps/): orthogonal map, consistent object scale and explicit collision geometry.
- [WorkAdventure furniture editor](https://docs.workadventu.re/map-building/inline-editor/entity-editor/): consistent object scale and floor/obstacle distinction. This project deliberately treats indoor furniture as passable decoration.
- [Kumospace owner guide](https://www.kumospace.com/virtual-office-guide/onboarding-for-space-owners): distinguish work, meetings and common areas by their purpose.

These are interaction/readability references, not downloaded production assets. No competitor artwork, characters, logos or proprietary maps are included. Do not describe the illustration as hand-drawn by the portfolio owner: the contribution is art direction, review, geometry alignment, integration and asset optimization.
