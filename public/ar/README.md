# AR henna assets

Place production assets in this folder as transparent PNG files. Each asset should contain only the henna artwork, with empty areas transparent and no hand, skin, background, shadow, or checkerboard baked into the image.

Register each asset in `src/main.jsx` inside `arDesignAssets` with its `assetPath`, `surface`, `orientation`, `opacity`, and landmark `anchors`. The current `15-01` entry uses the prepared transparent layers in `isolated-15-01/`: one palm layer plus separate thumb and finger layers, each mapped from authored endpoints. This keeps the palm and thumb independent from the finger transforms and is mirrored at runtime for the opposite hand.

For best results, prepare one straight-on palm-facing reference per design with the complete wrist and fingers visible. Keep the artwork aligned upright in the source image so the landmark mesh can preserve its proportions.
