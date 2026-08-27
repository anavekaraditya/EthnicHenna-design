export const PALM_MESH_SOURCE = [
  { x: 285, y: 900 },
  { x: 740, y: 900 },
  { x: 930, y: 480 },
  { x: 730, y: 120 },
  { x: 510, y: 80 },
  { x: 300, y: 120 },
  { x: 100, y: 470 },
  { x: 512, y: 540 },
]

export const PALM_MESH_TRIANGLES = [
  [7, 0, 1],
  [7, 1, 2],
  [7, 2, 3],
  [7, 3, 4],
  [7, 4, 5],
  [7, 5, 6],
  [7, 6, 0],
]

const FULL_PALM_SOURCE = [
  { x: 285, y: 1400 }, { x: 720, y: 1400 }, { x: 760, y: 850 }, { x: 650, y: 790 },
  { x: 510, y: 770 }, { x: 330, y: 860 }, { x: 740, y: 990 }, { x: 520, y: 900 },
]

const FULL_HAND_FINGER_SOURCE = {
  thumb: makeSourceQuad({ x: 740, y: 990 }, { x: 875, y: 430 }, 155, 70),
  index: makeSourceQuad({ x: 330, y: 860 }, { x: 370, y: 175 }, 105, 55),
  middle: makeSourceQuad({ x: 510, y: 770 }, { x: 515, y: 35 }, 112, 58),
  ring: makeSourceQuad({ x: 650, y: 790 }, { x: 665, y: 90 }, 108, 55),
  pinky: makeSourceQuad({ x: 760, y: 850 }, { x: 825, y: 220 }, 92, 48),
}

function makeSourceQuad(base, tip, baseWidth, tipWidth) {
  const axisX = tip.x - base.x
  const axisY = tip.y - base.y
  const length = Math.hypot(axisX, axisY) || 1
  const across = { x: -axisY / length, y: axisX / length }
  return [
    { x: tip.x - across.x * tipWidth / 2, y: tip.y - across.y * tipWidth / 2 },
    { x: tip.x + across.x * tipWidth / 2, y: tip.y + across.y * tipWidth / 2 },
    { x: base.x + across.x * baseWidth / 2, y: base.y + across.y * baseWidth / 2 },
    { x: base.x - across.x * baseWidth / 2, y: base.y - across.y * baseWidth / 2 },
  ]
}

export function mirrorLandmarks(landmarks, width) {
  return landmarks.map((point) => ({ x: (1 - point.x) * width, y: point.y }))
}

export function projectLandmarksToDisplay(landmarks, sourceWidth, sourceHeight, displayWidth, displayHeight, mirror = true) {
  if (!sourceWidth || !sourceHeight || !displayWidth || !displayHeight) return []
  const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight)
  const renderedWidth = sourceWidth * scale
  const renderedHeight = sourceHeight * scale
  const offsetX = (displayWidth - renderedWidth) / 2
  const offsetY = (displayHeight - renderedHeight) / 2
  return landmarks.map((point) => ({
    x: (mirror ? (1 - point.x) : point.x) * renderedWidth + offsetX,
    y: point.y * renderedHeight + offsetY,
  }))
}

export function createPalmMesh(points) {
  const wrist = points[0]
  const thumbMcp = points[2]
  const indexMcp = points[5]
  const middleMcp = points[9]
  const ringMcp = points[13]
  const pinkyMcp = points[17]
  const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y)
  const across = {
    x: (pinkyMcp.x - indexMcp.x) / (palmWidth || 1),
    y: (pinkyMcp.y - indexMcp.y) / (palmWidth || 1),
  }
  const wristIndexSide = {
    x: wrist.x - across.x * palmWidth * .48,
    y: wrist.y - across.y * palmWidth * .48,
  }
  const wristPinkySide = {
    x: wrist.x + across.x * palmWidth * .48,
    y: wrist.y + across.y * palmWidth * .48,
  }
  const boundary = [wristIndexSide, wristPinkySide, pinkyMcp, ringMcp, middleMcp, indexMcp, thumbMcp]
  const center = boundary.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 })
  return [...boundary, { x: center.x / boundary.length, y: center.y / boundary.length }]
}

function makeTargetQuad(points, indices, width) {
  const base = points[indices[0]]
  const tip = points[indices[indices.length - 1]]
  const axisX = tip.x - base.x
  const axisY = tip.y - base.y
  const length = Math.hypot(axisX, axisY) || 1
  const across = { x: -axisY / length, y: axisX / length }
  const baseHalfWidth = width * .56
  const tipHalfWidth = width * .34
  return [
    { x: tip.x - across.x * tipHalfWidth, y: tip.y - across.y * tipHalfWidth },
    { x: tip.x + across.x * tipHalfWidth, y: tip.y + across.y * tipHalfWidth },
    { x: base.x + across.x * baseHalfWidth, y: base.y + across.y * baseHalfWidth },
    { x: base.x - across.x * baseHalfWidth, y: base.y - across.y * baseHalfWidth },
  ]
}

export function smoothPoints(previous, next, amount = .32) {
  if (!previous) return next
  return next.map((point, index) => ({
    x: previous[index].x + (point.x - previous[index].x) * amount,
    y: previous[index].y + (point.y - previous[index].y) * amount,
  }))
}

export function hasTrackablePalm(landmarks) {
  return Boolean(landmarks?.[0] && landmarks?.[5] && landmarks?.[9] && landmarks?.[13] && landmarks?.[17])
}

export function drawMeshTriangle(context, image, source, target, opacity = .92) {
  const [sourceA, sourceB, sourceC] = source
  const [targetA, targetB, targetC] = target
  const determinant = sourceA.x * (sourceB.y - sourceC.y) + sourceB.x * (sourceC.y - sourceA.y) + sourceC.x * (sourceA.y - sourceB.y)
  if (Math.abs(determinant) < .001) return
  const solveCoordinate = (coordinate) => ({
    a: (coordinate(targetA) * (sourceB.y - sourceC.y) + coordinate(targetB) * (sourceC.y - sourceA.y) + coordinate(targetC) * (sourceA.y - sourceB.y)) / determinant,
    c: (coordinate(targetA) * (sourceC.x - sourceB.x) + coordinate(targetB) * (sourceA.x - sourceC.x) + coordinate(targetC) * (sourceB.x - sourceA.x)) / determinant,
    e: (coordinate(targetA) * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) + coordinate(targetB) * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) + coordinate(targetC) * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)) / determinant,
  })
  const x = solveCoordinate((point) => point.x)
  const y = solveCoordinate((point) => point.y)
  context.save()
  context.beginPath()
  context.moveTo(targetA.x, targetA.y)
  context.lineTo(targetB.x, targetB.y)
  context.lineTo(targetC.x, targetC.y)
  context.closePath()
  context.clip()
  context.transform(x.a, y.a, x.c, y.c, x.e, y.e)
  context.beginPath()
  context.moveTo(sourceA.x, sourceA.y)
  context.lineTo(sourceB.x, sourceB.y)
  context.lineTo(sourceC.x, sourceC.y)
  context.closePath()
  context.clip()
  context.globalAlpha = opacity
  context.drawImage(image, 0, 0)
  context.restore()
}

export function drawPalmMesh(context, image, targetPoints, opacity = .92) {
  if (!image?.naturalWidth || !image?.naturalHeight || !targetPoints?.length) return
  PALM_MESH_TRIANGLES.forEach((triangle) => {
    drawMeshTriangle(
      context,
      image,
      triangle.map((index) => PALM_MESH_SOURCE[index]),
      triangle.map((index) => targetPoints[index]),
      opacity,
    )
  })
}

export function drawFullHandMesh(context, image, points, opacity = .92, palmAnchors, sourceLayout) {
  if (!image?.naturalWidth || !image?.naturalHeight || !hasTrackablePalm(points)) return
  const palm = createPalmMesh(points)
  const palmClip = [palm[0], palm[1], points[17], points[13], points[9], points[5], points[2]]
  const sourcePalmAnchors = palmAnchors || {
    anchors_px: {
      wrist: [FULL_PALM_SOURCE[0].x, FULL_PALM_SOURCE[0].y],
      index_mcp: [FULL_PALM_SOURCE[5].x, FULL_PALM_SOURCE[5].y],
      pinky_mcp: [FULL_PALM_SOURCE[2].x, FULL_PALM_SOURCE[2].y],
    },
  }
  context.save()
  context.beginPath()
  palmClip.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
  context.closePath()
  context.clip()
  drawAnchoredAsset(context, image, points, sourcePalmAnchors, opacity)
  context.restore()
  const palmWidth = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y)
  const fingerRegions = [
    ['thumb', [1, 2, 3, 4], 1.05],
    ['index', [5, 6, 7, 8], 1],
    ['middle', [9, 10, 11, 12], 1.02],
    ['ring', [13, 14, 15, 16], .98],
    ['pinky', [17, 18, 19, 20], .9],
  ]
  fingerRegions.forEach(([name, indices, widthScale]) => {
    const customFinger = sourceLayout?.fingers?.[name]
    const sourceQuad = customFinger
      ? makeSourceQuad(customFinger.base, customFinger.tip, customFinger.baseWidth, customFinger.tipWidth)
      : FULL_HAND_FINGER_SOURCE[name]
    const targetQuad = makeTargetQuad(points, indices, palmWidth * .22 * widthScale)
    drawMeshTriangle(context, image, [sourceQuad[0], sourceQuad[1], sourceQuad[2]], [targetQuad[0], targetQuad[1], targetQuad[2]], opacity)
    drawMeshTriangle(context, image, [sourceQuad[0], sourceQuad[2], sourceQuad[3]], [targetQuad[0], targetQuad[2], targetQuad[3]], opacity)
  })
}

// Use one coherent transform for artwork that is already composed as a complete
// hand design. This avoids seams and stretched fragments when the source asset's
// motifs do not share the same topology as the tracked hand.
export function drawRigidHandArt(context, image, points, opacity = .92) {
  if (!image?.naturalWidth || !image?.naturalHeight || !hasTrackablePalm(points)) return
  const wrist = points[0]
  const middleMcp = points[9]
  const middleTip = points[12] || middleMcp
  const palmWidth = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y)
  if (!palmWidth) return

  // The generated dorsal asset's wrist cuff is near its lower center. Its
  // artwork is kept intact and scaled from the user's palm width.
  const sourceAnchor = { x: image.naturalWidth * .49, y: image.naturalHeight * .9 }
  const sourcePalmWidth = image.naturalWidth * .48
  const scale = palmWidth / sourcePalmWidth
  const sourceAxis = { x: 0, y: -image.naturalHeight * .52 }
  const targetAxis = { x: middleTip.x - wrist.x, y: middleTip.y - wrist.y }
  const sourceAngle = Math.atan2(sourceAxis.y, sourceAxis.x)
  const targetAngle = Math.atan2(targetAxis.y, targetAxis.x)
  const rotation = targetAngle - sourceAngle
  context.save()
  context.translate(wrist.x, wrist.y)
  context.rotate(rotation)
  context.globalAlpha = opacity
  context.drawImage(image, -sourceAnchor.x * scale, -sourceAnchor.y * scale, image.naturalWidth * scale, image.naturalHeight * scale)
  context.restore()
}

// Affine-map a prepared full-hand asset from three authored anchors. This is
// the preferred path for production artwork: the asset remains one continuous
// image while translation, scale, rotation, and shear follow the hand.
export function drawAnchoredAsset(context, image, points, anchors, opacity = .92) {
  if (!image?.naturalWidth || !image.naturalHeight || !hasTrackablePalm(points) || !anchors) return false
  const sourceNames = ['wrist', 'index_mcp', 'pinky_mcp']
  const landmarkIndexes = [0, 5, 17]
  const source = sourceNames.map((name) => {
    const [x, y] = anchors.anchors_px?.[name] || []
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  })
  if (source.some((point) => !point)) return false
  const target = landmarkIndexes.map((index) => points[index])
  const [s0, s1, s2] = source
  const [d0, d1, d2] = target
  const ux = s1.x - s0.x
  const uy = s1.y - s0.y
  const vx = s2.x - s0.x
  const vy = s2.y - s0.y
  const determinant = ux * vy - uy * vx
  if (Math.abs(determinant) < 1) return false
  const dux = d1.x - d0.x
  const duy = d1.y - d0.y
  const dvx = d2.x - d0.x
  const dvy = d2.y - d0.y
  const a = (dux * vy - dvx * uy) / determinant
  const c = (dvx * ux - dux * vx) / determinant
  const b = (duy * vy - dvy * uy) / determinant
  const d = (dvy * ux - duy * vx) / determinant
  context.save()
  context.globalAlpha = opacity
  // Compose with the canvas' existing device-pixel transform. Replacing it
  // with setTransform makes the overlay wrong on high-DPI phone screens.
  context.transform(a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y)
  context.drawImage(image, 0, 0)
  context.restore()
  return true
}

export function drawAnchoredPairAsset(context, image, points, sourceAnchors, landmarkIndexes, opacity = .92, targetWidth) {
  if (!image?.naturalWidth || !image.naturalHeight || !points || !sourceAnchors) return false
  const [sourceStart, sourceEnd] = sourceAnchors
  const [targetStart, targetEnd] = landmarkIndexes.map((index) => points[index] || null)
  if (!targetStart || !targetEnd) return false
  const sourceDx = sourceEnd[0] - sourceStart[0]
  const sourceDy = sourceEnd[1] - sourceStart[1]
  const targetDx = targetEnd.x - targetStart.x
  const targetDy = targetEnd.y - targetStart.y
  const sourceLength = Math.hypot(sourceDx, sourceDy)
  if (!sourceLength) return false
  const targetLength = Math.hypot(targetDx, targetDy)
  const sourceWidth = image.naturalWidth
  const width = targetWidth || sourceWidth * targetLength / sourceLength
  const sourceQuad = makeSourceQuad(
    { x: sourceStart[0], y: sourceStart[1] },
    { x: sourceEnd[0], y: sourceEnd[1] },
    sourceWidth,
    sourceWidth,
  )
  const targetQuad = makeTargetQuadFromEndpoints(targetStart, targetEnd, width)
  drawMeshTriangle(context, image, [sourceQuad[0], sourceQuad[1], sourceQuad[2]], [targetQuad[0], targetQuad[1], targetQuad[2]], opacity)
  drawMeshTriangle(context, image, [sourceQuad[0], sourceQuad[2], sourceQuad[3]], [targetQuad[0], targetQuad[2], targetQuad[3]], opacity)
  return true
}

function makeTargetQuadFromEndpoints(start, end, width) {
  const axisX = end.x - start.x
  const axisY = end.y - start.y
  const length = Math.hypot(axisX, axisY) || 1
  const across = { x: -axisY / length, y: axisX / length }
  const halfWidth = width / 2
  return [
    { x: end.x - across.x * halfWidth, y: end.y - across.y * halfWidth },
    { x: end.x + across.x * halfWidth, y: end.y + across.y * halfWidth },
    { x: start.x + across.x * halfWidth, y: start.y + across.y * halfWidth },
    { x: start.x - across.x * halfWidth, y: start.y - across.y * halfWidth },
  ]
}

export function drawPreparedHand(context, images, points, config, opacity = .92) {
  if (!hasTrackablePalm(points) || !config?.palm || !images?.palm) return false
  let drawn
  if (config.palm.middle_mcp) {
    drawn = drawAnchoredPairAsset(context, images.palm, points, [config.palm.wrist, config.palm.middle_mcp], [0, 9], opacity)
  } else {
    drawn = drawAnchoredAsset(context, images.palm, points, { anchors_px: config.palm }, opacity)
  }
  if (config.palmOnly) return drawn
  const fingers = [
    ['thumb', 2, 4, .25],
    ['index', 5, 8, .2],
    ['middle', 9, 12, .2],
    ['ring', 13, 16, .2],
    ['pinky', 17, 20, .18],
  ]
  const palmWidth = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y)
  fingers.forEach(([name, mcp, tip, widthScale]) => {
    const part = config[name]
    if (part && images[name]) drawn = drawAnchoredPairAsset(context, images[name], points, [part.mcp, part.tip], [mcp, tip], opacity, palmWidth * widthScale) || drawn
  })
  return drawn
}

export function drawGloveTemplate(context, points, options = {}) {
  if (!hasTrackablePalm(points) || !context) return false
  const fill = options.fill || 'rgba(194, 102, 79, .3)'
  const palmMesh = createPalmMesh(points)
  const palm = [palmMesh[0], palmMesh[1], points[17], points[13], points[9], points[5], points[2]]
  const fingers = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]
  const palmWidth = Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y)
  const fingerWidth = Math.max(12, palmWidth * .2)
  const topY = Math.min(...points.map((point) => point.y))
  const bottomY = Math.max(...points.map((point) => point.y))

  context.save()
  context.globalAlpha = options.opacity ?? 1
  // A vertical multi-stop gradient gives the glove a brushed, metallic
  // surface instead of a flat translucent fill.
  const material = context.createLinearGradient(0, topY, 0, bottomY || topY + 1)
  material.addColorStop(0, 'rgba(91, 39, 34, .62)')
  material.addColorStop(.16, 'rgba(255, 224, 211, .72)')
  material.addColorStop(.3, 'rgba(154, 70, 56, .54)')
  material.addColorStop(.47, fill)
  material.addColorStop(.62, 'rgba(255, 237, 228, .68)')
  material.addColorStop(.78, 'rgba(116, 45, 37, .58)')
  material.addColorStop(1, 'rgba(236, 164, 143, .46)')
  context.fillStyle = material
  context.shadowColor = 'rgba(44, 16, 13, .34)'
  context.shadowBlur = 7
  context.shadowOffsetY = 3

  context.beginPath()
  palm.forEach((point, position) => {
    if (position === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  })
  context.closePath()
  context.fill()

  // Build the glove as one connected piece: this softly bridges the finger
  // roots into the palm without bringing back the old landmark boxes.
  context.beginPath()
  context.moveTo(points[5].x, points[5].y)
  context.lineTo(points[9].x, points[9].y)
  context.lineTo(points[13].x, points[13].y)
  context.lineTo(points[17].x, points[17].y)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = fingerWidth * 1.35
  context.strokeStyle = material
  context.stroke()

  fingers.forEach((finger) => {
    context.beginPath()
    finger.forEach((index, position) => {
      const point = points[index]
      if (position === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = fingerWidth
    context.strokeStyle = material
    context.stroke()
  })

  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  // A narrow reflected-light pass makes the material read as polished metal
  // while avoiding any dark contour that could resemble the old debug boxes.
  context.globalCompositeOperation = 'screen'
  context.strokeStyle = 'rgba(255, 248, 244, .24)'
  context.lineWidth = Math.max(1.2, fingerWidth * .055)
  context.lineCap = 'round'
  fingers.forEach((finger) => {
    context.beginPath()
    finger.forEach((index, position) => {
      const point = points[index]
      if (position === 0) context.moveTo(point.x, point.y)
      else context.lineTo(point.x, point.y)
    })
    context.stroke()
  })
  context.restore()
  return true
}
