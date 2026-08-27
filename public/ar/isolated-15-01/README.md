# Henna AR assets — IMG_1183

Source: `4ee82e8a-d46d-42f0-8cc5-2b8d12d661d9.png`.

The supplied artwork was already isolated and upright, with the wrist at the bottom. Its existing alpha channel was preserved and the black background was removed.

## Assets

- `henna_full_hand.png`: complete artwork for a single planar hand overlay.
- `henna_palm.png`: palm/back-of-hand cluster, excluding most finger artwork.
- `henna_thumb.png`, `henna_index.png`, `henna_middle.png`, `henna_ring.png`,
  `henna_pinky.png`: independent finger/side assets for landmark-calibrated
  placement.

## Extraction limitations

This bundle uses the supplied isolated source alpha directly. No hand, skin, fabric, or photograph reconstruction was performed. The source artwork itself is raster artwork, not a vector trace.

## Anchor convention

Anchors are reported in each PNG's local pixel coordinates in `anchors.json`.
For the full-hand asset, align `wrist` to MediaPipe landmark 0 and use the
`index_mcp` / `middle_mcp` / `pinky_mcp` anchors to solve the hand transform.
For each finger asset, align its `mcp` anchor to the corresponding MediaPipe
MCP landmark and its `tip` anchor to the corresponding fingertip landmark.
