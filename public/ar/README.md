# AR henna assets

Place production assets in this folder as transparent PNG files. Each asset should contain only the henna artwork, with empty areas transparent and no hand, skin, background, shadow, or checkerboard baked into the image.

Register each asset in `src/main.jsx` inside `arDesignAssets` with its `assetPath`, `surface`, `orientation`, `opacity`, and landmark `anchors`. The locked `15-01` asset is the reference-based transparent part pack in `reference-15-01/`: `palm.png`, `thumb.png`, `index.png`, `middle.png`, `ring.png`, and `pinky.png`. The `20-11` asset uses `reference-20-11/palm.png` and `reference-20-11/middle.png`; its other finger regions are intentionally omitted because the supplied design only includes the middle-finger band. The `20-04` asset uses the complete six-part pack in `reference-20-04/`, and `25-02` uses the complete six-part pack in `reference-25-02/`, with each region linked directly to the corresponding geometric-glove landmarks. All packs mirror for the opposite hand. The original reference PNGs are retained as reviewed source compositions.

Finger parts may include `landmarks: [start, end]` when artwork occupies only part of a finger. The default remains MCP-to-tip for existing packs; 20-04 uses partial ranges for its shorter finger motifs.

For best results, prepare one straight-on palm-facing reference per design with the complete wrist and fingers visible. Keep the artwork aligned upright in the source image so the landmark mesh can preserve its proportions.
