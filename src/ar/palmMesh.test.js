import assert from 'node:assert/strict'
import test from 'node:test'
import { createPalmMesh, drawAnchoredAsset, hasTrackablePalm, mirrorLandmarks, projectLandmarksToDisplay, smoothPoints } from './palmMesh.js'

const landmarks = Array.from({ length: 21 }, (_, index) => ({ x: index / 20, y: index / 40 }))

test('mirrors normalized front-camera x coordinates without changing y', () => {
  const mirrored = mirrorLandmarks([{ x: .2, y: .3 }, { x: .8, y: .7 }], 100)
  assert.equal(mirrored[0].x, 80)
  assert.ok(Math.abs(mirrored[1].x - 20) < 1e-12)
  assert.deepEqual(mirrored.map((point) => point.y), [.3, .7])
})

test('projects mirrored landmarks through object-fit cover crop', () => {
  const projected = projectLandmarksToDisplay([{ x: 0, y: 0 }, { x: 1, y: 1 }], 640, 480, 400, 600)
  assert.deepEqual(projected, [{ x: 600, y: 0 }, { x: -200, y: 600 }])
})

test('creates a palm mesh with seven boundary anchors and an interior anchor', () => {
  const mesh = createPalmMesh(landmarks)
  assert.equal(mesh.length, 8)
  assert.deepEqual(mesh[2], landmarks[17])
  assert.ok(Number.isFinite(mesh[7].x))
  assert.ok(Number.isFinite(mesh[7].y))
})

test('smooths each mesh point toward the next frame', () => {
  const previous = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
  const next = [{ x: 10, y: 20 }, { x: 20, y: 30 }]
  assert.deepEqual(smoothPoints(previous, next, .5), [{ x: 5, y: 10 }, { x: 15, y: 20 }])
  assert.deepEqual(smoothPoints(null, next), next)
})

test('requires the palm landmarks before showing the overlay', () => {
  assert.equal(hasTrackablePalm(landmarks), true)
  assert.equal(hasTrackablePalm([]), false)
  assert.equal(hasTrackablePalm(null), false)
})

test('maps a prepared full-hand asset from authored anchors', () => {
  const transforms = []
  const context = { globalAlpha: 1, save() {}, restore() {}, transform(...args) { transforms.push(args) }, drawImage() {} }
  const image = { naturalWidth: 714, naturalHeight: 1532 }
  const points = Array.from({ length: 21 }, (_, index) => ({ x: index * 10, y: index * 5 }))
  points[0] = { x: 100, y: 400 }
  points[5] = { x: 60, y: 150 }
  points[17] = { x: 150, y: 160 }
  assert.equal(drawAnchoredAsset(context, image, points, { anchors_px: { wrist: [507, 1502], index_mcp: [257, 662], pinky_mcp: [752, 642] } }), true)
  assert.equal(transforms.length, 1)
  assert.ok(transforms[0].every(Number.isFinite))
})
