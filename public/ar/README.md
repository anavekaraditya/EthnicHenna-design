# AR henna assets

Place production assets in this folder as transparent PNG files. Each asset should contain only the henna artwork, with empty areas transparent and no hand, skin, background, shadow, or checkerboard baked into the image.

Register each asset in `src/main.jsx` inside `arDesignAssets` with its `assetPath`, `surface`, `orientation`, `opacity`, and landmark `anchors`. The active `15-01` asset is the reference-based transparent part pack in `reference-15-01/`: `palm.png`, `thumb.png`, `index.png`, `middle.png`, `ring.png`, and `pinky.png`. Each region is linked directly to the corresponding geometric-glove landmarks and mirrors for the opposite hand. The original `design-15-01-reference.png` is retained as the reviewed source composition.

For best results, prepare one straight-on palm-facing reference per design with the complete wrist and fingers visible. Keep the artwork aligned upright in the source image so the landmark mesh can preserve its proportions.
