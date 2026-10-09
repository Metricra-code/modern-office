# Asset provenance

- Current office map: original AI-assisted illustration generated with the built-in image generation tool in this Codex session, stored locally. The app makes **no runtime image-generation or paid API requests**.
- Source: `docs/assets/office-map-source.png` (1575 × 998); browser asset: `public/office-map.webp` (about 159 KB, optimized with Sharp already bundled by Next.js).
- Art direction: orthographic 2D pixel-art coworking studio, consistent furniture scale, warm ivory floors, honey-oak desks, restrained sage/blue/terracotta details. Four functional rooms and a clear tiled corridor replace the earlier photorealistic miniature.
- Prompt summary: "Original overhead pixel-art virtual office; four desk studio, six-chair meeting table, two quiet desks, sofa and coffee corner; wide uninterrupted horizontal hallway, visible door gaps; no characters, text, brands or UI."
- Shared 900 × 570 geometry follows the room walls and office perimeter. Furniture, plants and rugs are decorative and passable, so room interiors do not obstruct movement. Unit tests check open corridors, eight-unit keyboard routes into all four rooms, room arrival points and sample positions; E2E verifies furniture traversal, wall boundaries, live movement synchronization and zoom controls.
- The superseded `docs/assets/office-floorplan-source.png` is retained only as a design-history source; it is not shipped to browsers.
- Typography: bundled Manrope and Urbanist via Fontsource; license notices are in `public/licenses/`. No Google Fonts CDN requests.
- Icons: Lucide via `lucide-react`; the complete ISC and Feather-derived MIT notices are preserved unchanged in `public/licenses/lucide-react.txt`. Brand mark and social cover use project-native SVG geometry; social PNG is derived from the SVG.

## Market references, not copied assets

- [Gather virtual office](https://www.gather.town/virtual-office): readable spatial presence, distinct functional rooms and modest furniture detail. Gather has both Classic and 2.0; this project is not a clone of either.
- [Gather 2.0 navigation guide](https://support.help.gather.town/articles/1982412443-getting-started-guide): keep people and conversations legible; support keyboard navigation and zoom.
- [WorkAdventure official map rules](https://docs.workadventu.re/map-building/tiled-editor/wa-maps/): orthogonal map, consistent object scale and explicit collision geometry.
- [WorkAdventure furniture editor](https://docs.workadventu.re/map-building/inline-editor/entity-editor/): consistent object scale and floor/obstacle distinction. This project deliberately treats indoor furniture as passable decoration.
- [Kumospace owner guide](https://www.kumospace.com/virtual-office-guide/onboarding-for-space-owners): distinguish work, meetings and common areas by their purpose.

These are interaction/readability references, not downloaded production assets. No competitor artwork, characters, logos or proprietary maps are included. Do not describe the illustration as hand-drawn by the portfolio owner: the contribution is art direction, review, geometry alignment, integration and asset optimization.
