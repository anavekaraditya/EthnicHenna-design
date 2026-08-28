import React, { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { createPalmMesh, drawAnchoredAsset, drawFullHandMesh, drawGloveTemplate, drawPalmMesh, drawPreparedHand, drawRigidHandArt, hasTrackablePalm, projectLandmarksToDisplay, smoothPoints } from './ar/palmMesh.js'
import { applySeoMetadata, getPageKey } from './seo.js'
import './styles.css'

const imageFiles = {
  15: ['IMG_0579.jpg', 'IMG_1073.jpg', 'IMG_1566.jpg', 'IMG_3456.jpg', 'IMG_3457.jpg', 'IMG_3514.jpg', 'IMG_4387.jpg', 'IMG_4631.jpg', 'IMG_5205.jpg', 'IMG_5901.jpg', 'IMG_6011.jpg', 'IMG_8020.jpg', 'IMG_9332.jpg'],
  20: ['IMG_0446.jpg', 'IMG_0298.jpg', 'IMG_0445.jpg', 'IMG_0641.jpg', 'IMG_0845.jpg', 'IMG_0847.jpg', 'IMG_0849.jpg', 'IMG_2640.jpg', 'IMG_2878.jpg', 'IMG_3047.jpg', 'IMG_5083.jpg', 'IMG_5084.jpg', 'IMG_9821.jpg'],
  25: ['IMG_0331.jpg', 'IMG_1001.jpg', 'IMG_1183.jpg', 'IMG_2267.jpg', 'IMG_2555.jpg', 'IMG_2640.jpg', 'IMG_3595.jpg', 'IMG_8102.jpg', 'IMG_9089.jpg', 'IMG_9819.jpg'],
}

// Curated portfolio images are intentionally separate from the individual design menu.
// Replace or extend this list when Deepali provides the dedicated best-work photos.
const curatedPortfolioFiles = [
  '/portfolio/ethnic-henna-13.jpg',
  '/portfolio/ethnic-henna-09.jpg',
  '/portfolio/ethnic-henna-14.jpg',
  '/portfolio/ethnic-henna-04.jpg',
  '/portfolio/ethnic-henna-12.jpg',
  '/portfolio/ethnic-henna-07.jpg',
  '/portfolio/ethnic-henna-15.jpg',
  '/portfolio/ethnic-henna-11.jpg',
  '/portfolio/ethnic-henna-02.jpg',
  '/portfolio/ethnic-henna-16.jpg',
  '/portfolio/ethnic-henna-08.jpg',
  '/portfolio/ethnic-henna-05.jpg',
  '/portfolio/ethnic-henna-17.jpg',
  '/portfolio/ethnic-henna-10.jpg',
  '/portfolio/ethnic-henna-01.jpg',
]

const portfolioAltTexts = [
  'Detailed henna patterns across two hands on a golden textile',
  'Paired hands decorated with intricate floral henna',
  'Fine henna details across a decorated hand and wrist',
  'Bridal hands with ornate henna against a rich red outfit',
  'Intricate henna on hands framed by colorful bridal textiles',
  'A detailed henna hand resting against embroidered fabric',
  'Bridal henna details paired with red and gold jewelry',
  'Deep brown bridal henna across hands resting on light embroidery',
  'Henna-covered hands styled with colorful bridal bangles',
  'A close view of patterned henna across a decorated hand',
  'Floral and geometric henna details across a palm and fingers',
  'A full hand henna composition with layered floral motifs',
  'Detailed henna patterns on hands styled for a celebration',
  'Fine henna bands and florals across a hand and wrist',
]

const portfolioDimensions = {
  'ethnic-henna-01.jpg': [1440, 1800],
  'ethnic-henna-02.jpg': [1440, 1800],
  'ethnic-henna-04.jpg': [3072, 4096],
  'ethnic-henna-05.jpg': [2925, 3900],
  'ethnic-henna-06.jpg': [3072, 4096],
  'ethnic-henna-07.jpg': [2534, 3378],
  'ethnic-henna-08.jpg': [3072, 4096],
  'ethnic-henna-09.jpg': [2870, 3826],
  'ethnic-henna-10.jpg': [1440, 1440],
  'ethnic-henna-11.jpg': [1440, 1800],
  'ethnic-henna-12.jpg': [2228, 2189],
  'ethnic-henna-13.jpg': [2268, 2228],
  'ethnic-henna-14.jpg': [682, 1024],
  'ethnic-henna-15.jpg': [1090, 1078],
  'ethnic-henna-16.jpg': [1125, 1163],
  'ethnic-henna-17.jpg': [576, 1024],
}

function portfolioData() {
  return curatedPortfolioFiles.map((src, index) => ({
    src,
    id: `portfolio-${String(index + 1).padStart(2, '0')}`,
    alt: portfolioAltTexts[index] || 'Detailed henna work on a hand',
  }))
}

function PortfolioImage({ design, loading = 'lazy' }) {
  const filename = design.src.split('/').pop().replace(/\.jpg$/i, '')
  const optimizedSrcSet = `/portfolio/optimized/${filename}-800.webp 800w, /portfolio/optimized/${filename}-1400.webp 1400w`
  const [width, height] = portfolioDimensions[`${filename}.jpg`] || [1400, 1750]
  return <picture className="portfolio-image-picture"><source type="image/webp" srcSet={optimizedSrcSet} sizes="(max-width: 720px) 50vw, 25vw" /><img src={design.src} alt={design.alt} loading={loading} decoding="async" width={width} height={height} /></picture>
}

// Each AR asset is authored for a known body surface. Add future designs here
// with their transparent asset, orientation, opacity, and landmark contract.
// AR artwork is registered only after its transparent negative space and
// motif fidelity have been reviewed against the supplied reference.
const arDesignAssets = {
  '15-01': {
    assetDirectory: '/ar/reference-15-01',
    surface: 'prepared-hand',
    orientation: 'left-dorsal',
    handSide: 'back-of-hand',
    mirrorForOppositeHand: true,
    opacity: .9,
    parts: {
      // Map every transparent region directly to the geometric-glove
      // landmarks so finger artwork cannot collapse inside one transform.
      palm: { wrist: [290, 810], middle_mcp: [290, 45] },
      thumb: { mcp: [95, 160], tip: [45, 50] },
      index: { mcp: [90, 500], tip: [90, 35] },
      middle: { mcp: [90, 465], tip: [90, 30] },
      ring: { mcp: [85, 470], tip: [85, 40] },
      pinky: { mcp: [80, 370], tip: [80, 45] },
    },
  },
  // 20-11 is intentionally the only new asset in this pass. Its artwork is
  // authored as one palm region plus one middle-finger region, matching the
  // same geometric-glove landmarks used by the locked 15-01 setup.
  '20-11': {
    assetDirectory: '/ar/reference-20-11',
    surface: 'prepared-hand',
    orientation: 'left-dorsal',
    handSide: 'back-of-hand',
    mirrorForOppositeHand: true,
    opacity: .9,
    parts: {
      palm: { wrist: [434, 874], middle_mcp: [434, 130] },
      middle: { mcp: [163, 410], tip: [163, 30] },
    },
  },
  '20-04': {
    assetDirectory: '/ar/reference-20-04',
    surface: 'prepared-hand',
    orientation: 'left-dorsal',
    handSide: 'back-of-hand',
    mirrorForOppositeHand: true,
    opacity: .9,
    parts: {
      palm: { wrist: [430, 1015], middle_mcp: [430, 120] },
      thumb: { mcp: [92, 375], tip: [92, 25], landmarks: [2, 4] },
      index: { mcp: [98, 425], tip: [98, 25], landmarks: [6, 8] },
      middle: { mcp: [100, 420], tip: [100, 20] },
      ring: { mcp: [100, 400], tip: [100, 20], landmarks: [13, 15] },
      pinky: { mcp: [92, 365], tip: [92, 20], landmarks: [17, 19] },
    },
  },
  '25-02': {
    assetDirectory: '/ar/reference-25-02',
    surface: 'prepared-hand',
    orientation: 'left-dorsal',
    handSide: 'back-of-hand',
    mirrorForOppositeHand: true,
    opacity: .9,
    parts: {
      palm: { wrist: [390, 710], middle_mcp: [390, 20] },
      thumb: { mcp: [95, 560], tip: [95, 20], landmarks: [2, 4] },
      // This asset is tightly cropped to the index motif. The lower anchor
      // sits at the last hanging leaf, which is the visual base of the art;
      // anchoring it to the PIP avoids stretching the entire crop across the
      // finger and keeps the neighboring motif out of the transform.
      index: { mcp: [72, 500], tip: [72, 20], landmarks: [6, 8] },
      middle: { mcp: [132, 730], tip: [132, 20], landmarks: [9, 12] },
      ring: { mcp: [115, 650], tip: [115, 20], landmarks: [13, 15] },
      pinky: { mcp: [110, 630], tip: [110, 20], landmarks: [17, 19] },
    },
  },
}

const initialCollections = Object.entries(imageFiles).map(([price, files]) => ({
  price: Number(price),
  label: `$${price}`,
  description: price === '15' ? 'Beautiful essentials for a first look.' : price === '20' ? 'A little more detail for your next celebration.' : 'Signature designs made to leave an impression.',
  designs: files.map((file, index) => ({
    id: `${price}-${String(index + 1).padStart(2, '0')}`,
    src: `/${price}/${file}`,
    alt: `Henna design ${price}-${String(index + 1).padStart(2, '0')} from the ${price} dollar collection`,
  })),
}))

const collectionsStorageKey = 'deepali-henna-collections-v1'
const adminSessionKey = 'deepali-henna-admin-session'
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'deepali1234'

function loadCollections() {
  try {
    const saved = localStorage.getItem(collectionsStorageKey)
    return saved ? JSON.parse(saved) : initialCollections
  } catch {
    return initialCollections
  }
}

function saveCollections(nextCollections) {
  localStorage.setItem(collectionsStorageKey, JSON.stringify(nextCollections))
}

const whatsappNumber = '15103408849'
const venmoLink = 'https://venmo.com/code?user_id=2414993068785664394&created=1774645132.445458'
const websiteUrl = 'https://ethnic-henna-design.vercel.app/designs'
const whatsappMessage = (design, imageUrl) => encodeURIComponent(`Hi Deepali,\n\nI’m interested in design ${design.id} from the $${design.price} collection.\n\nDESIGN IMAGE\n${imageUrl}\n\nMORE DESIGNS\nOpen the website to view more designs:\n${websiteUrl}\n\nPAYMENT OPTIONS\nVenmo: ${venmoLink}\nZelle: ${whatsappNumber}\n\nPAYMENT CONFIRMATION\nAfter completing payment, please share a screenshot of your payment confirmation here.`)

function ArrowIcon({ direction = 'right' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`icon icon-${direction}`}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d="M6 6l12 12M18 6L6 18" /></svg>
}

function WhatsAppIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="whatsapp-icon"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.5 4.1 1.6 5.9L.2 24l6.5-1.7a11.8 11.8 0 0 0 5.4 1.3h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.3-6.1-3.5-8.3ZM12.1 21.6c-1.7 0-3.4-.5-4.8-1.4l-.3-.2-3.9 1 1-3.8-.2-.4a9.8 9.8 0 1 1 8.2 4.8Zm5.4-7.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-1.7-.8-2.8-1.4-3.9-3.2-.3-.5.3-.5.8-1.6.1-.3.1-.5 0-.7-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.3 1.4.5 1.9.7.8.3 1.5.2 2 .1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.1-1.3-.2-.2-.4-.3-.7-.4Z" /></svg>
}

function PublicNav({ current }) {
  const links = [['work', 'Work', '/work'], ['pricing', 'Design by Pricing', '/designs'], ['bridal', 'Bridal', '/bridal'], ['events', 'Events', '/events']]
  return <header className="landing-header"><a className="wordmark" href="/" aria-label="Ethnic Henna by Deepali home"><img className="wordmark-logo" src="/deepali-logo-mark.png" alt="" /><span className="wordmark-label">Ethnic Henna by Deepali</span></a><nav className="landing-nav" aria-label="Main navigation">{links.map(([key, label, href]) => <a className={current === key ? 'is-current' : ''} href={href} key={key}>{label}</a>)}</nav><a className="header-whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><WhatsAppIcon /><span>WhatsApp</span></a></header>
}

function CollectionCard({ collection, onSelect }) {
  return (
    <button className="collection-card" onClick={() => onSelect(collection.price)} aria-label={`View ${collection.label} collection`}>
      <span className="collection-image-wrap">{collection.designs[0] ? <img src={collection.designs[0].src} alt="" loading="lazy" /> : <span className="collection-image-empty">Add your first design</span>}</span>
      <span className="collection-card-body">
        <span className="collection-card-top"><span className="eyebrow">Collection</span><span className="collection-count">{collection.designs.length} designs</span></span>
        <span className="collection-price">{collection.label}</span>
        <span className="collection-description">{collection.description}</span>
        <span className="collection-link">Explore collection <ArrowIcon /></span>
      </span>
    </button>
  )
}

function Lightbox({ selected, onClose, onPrevious, onNext }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const touchStart = useRef(null)
  const [showAr, setShowAr] = useState(false)
  const imageUrl = new URL(selected.design.src, window.location.href).href
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${whatsappMessage({ ...selected.design, price: selected.collection.price }, imageUrl)}`

  useEffect(() => {
    const previousFocus = document.activeElement
    document.body.classList.add('modal-open')
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onPrevious()
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [onClose, onNext, onPrevious])

  return (
    <div className="lightbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Design ${selected.design.id}`} ref={dialogRef} onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX }} onTouchEnd={(event) => { const start = touchStart.current; const end = event.changedTouches[0].clientX; if (start && Math.abs(start - end) > 45) start > end ? onNext() : onPrevious(); touchStart.current = null }}>
        <div className="lightbox-toolbar"><span className="lightbox-position">{selected.index + 1} / {selected.collection.designs.length}</span><button className="icon-button" onClick={onClose} ref={closeRef} aria-label="Close design preview"><CloseIcon /></button></div>
        <div className="lightbox-image-frame"><img src={selected.design.src} alt={selected.design.alt} /></div>
        <div className="lightbox-details"><div><span className="eyebrow">Design {selected.design.id}</span><h2>{selected.collection.label} collection</h2></div><div className="lightbox-actions">{arDesignAssets[selected.design.id] && <button className="whatsapp-button lightbox-ar-button" type="button" onClick={() => setShowAr(true)}>Try on your hand</button>}<a className="whatsapp-button" href={whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon /> Send it to artist</a></div></div>
        <div className="lightbox-nav"><button className="nav-button" onClick={onPrevious} aria-label="Previous design"><ArrowIcon direction="left" /> Previous</button><button className="nav-button" onClick={onNext} aria-label="Next design">Next <ArrowIcon /></button></div>
      </div>
      {showAr && <ArPreview design={selected.design} onClose={() => setShowAr(false)} />}
    </div>
  )
}

function ArPreview({ design, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const artImagesRef = useRef({})
  const artAssetRef = useRef(arDesignAssets[design.id] || { surface: 'none' })
  const streamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const frameRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const meshRef = useRef(null)
  const landmarksRef = useRef(null)
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraState, setCameraState] = useState('idle')
  const [cameraReady, setCameraReady] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [cameraFacing, setCameraFacing] = useState('user')
  const [artLoading, setArtLoading] = useState(true)
  const [artError, setArtError] = useState('')

  useEffect(() => {
    const asset = artAssetRef.current
    if (asset.surface === 'prepared-hand') {
      const names = ['palm', 'thumb', 'index', 'middle', 'ring', 'pinky']
      const requiredNames = names.filter((name) => asset.parts?.[name] || name === 'palm')
      let loadedCount = 0
      const markLoaded = () => {
        loadedCount += 1
        if (loadedCount === requiredNames.length) setArtLoading(false)
      }
      requiredNames.forEach((name) => {
        const image = new Image()
        image.onload = markLoaded
        image.onerror = () => {
          setArtError(`The ${name} artwork could not be loaded.`)
          setArtLoading(false)
        }
        image.src = asset.assetDirectory
          ? `${asset.assetDirectory}/${name}.png`
          : `/ar/isolated-15-01/henna_${name}.png`
        artImagesRef.current[name] = image
      })
    } else if (asset.assetPath) {
      const artImage = new Image()
      artImage.onload = () => setArtLoading(false)
      artImage.onerror = () => {
        setArtError('The selected artwork could not be loaded.')
        setArtLoading(false)
      }
      artImage.src = asset.assetPath
      artImagesRef.current.single = artImage
    } else {
      setArtLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cameraActive) return undefined
    let cancelled = false
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera preview is not supported in this browser.')
        setCameraState('error')
        return
      }
      setCameraState('loading')
      setCameraReady(false)
      setTracking(false)
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false })
      } catch {
        setCameraError('Camera access was blocked. Allow camera access for this site, then reopen the preview.')
        setCameraState('error')
        return
      }
      if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraReady(true)
      setCameraError('')

      try {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm')
        const options = {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          },
          numHands: 1,
          runningMode: 'VIDEO',
        }
        try {
          landmarkerRef.current = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } })
        } catch {
          landmarkerRef.current = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } })
        }
        setCameraState('ready')

        const trackHand = () => {
          if (cancelled) return
          const video = videoRef.current
          const landmarker = landmarkerRef.current
          if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime
            const result = landmarker.detectForVideo(video, performance.now())
            const landmarks = result.landmarks?.[0]
            const preparedImagesReady = Object.values(artImagesRef.current).every((image) => image.complete && image.naturalWidth)
            if (hasTrackablePalm(landmarks) && canvasRef.current) {
              // Keep tracking status independent from artwork readiness. A
              // missing asset must never be presented as a missing hand.
              setTracking(true)
              if (!preparedImagesReady) {
                canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                frameRef.current = requestAnimationFrame(trackHand)
                return
              }
              const points = projectLandmarksToDisplay(landmarks, video.videoWidth, video.videoHeight, video.clientWidth, video.clientHeight, cameraFacing === 'user')
              const stablePoints = smoothPoints(landmarksRef.current, points, .32)
              landmarksRef.current = stablePoints
              const mesh = createPalmMesh(stablePoints)
              meshRef.current = mesh
              const canvas = canvasRef.current
              const dpr = window.devicePixelRatio || 1
              const width = video.clientWidth
              const height = video.clientHeight
              if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
                canvas.width = Math.round(width * dpr)
                canvas.height = Math.round(height * dpr)
                canvas.style.width = `${width}px`
                canvas.style.height = `${height}px`
              }
              const context = canvas.getContext('2d')
              context.setTransform(dpr, 0, 0, dpr, 0, 0)
              context.clearRect(0, 0, width, height)
              if (artAssetRef.current.surface === 'glove-template') drawGloveTemplate(context, stablePoints, { opacity: .95 })
              else if (artAssetRef.current.surface === 'prepared-hand') drawPreparedHand(context, artImagesRef.current, stablePoints, artAssetRef.current.parts, artAssetRef.current.opacity)
              else if (artAssetRef.current.surface === 'rigid-hand') drawRigidHandArt(context, artImagesRef.current.single, stablePoints, artAssetRef.current.opacity)
              else if (artAssetRef.current.surface === 'full-hand') drawFullHandMesh(context, artImagesRef.current.single, stablePoints, artAssetRef.current.opacity, artAssetRef.current.palmAnchors, artAssetRef.current.sourceLayout)
              else drawPalmMesh(context, artImagesRef.current.single, mesh, artAssetRef.current.opacity)
            } else {
              if (canvasRef.current) canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
              meshRef.current = null
              landmarksRef.current = null
              setTracking(false)
            }
          }
          frameRef.current = requestAnimationFrame(trackHand)
        }
        frameRef.current = requestAnimationFrame(trackHand)
      } catch {
        setCameraError('Camera is working, but the hand-tracking model could not load. Check your connection and try again.')
        setCameraState('error')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [cameraActive, cameraFacing])

  const resetPreview = () => {
    meshRef.current = null
    landmarksRef.current = null
    lastVideoTimeRef.current = -1
    setTracking(false)
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  const stopCamera = () => {
    setCameraActive(false)
    setCameraReady(false)
    setCameraState('idle')
    resetPreview()
  }

  const switchCamera = () => {
    if (!cameraActive) return
    setCameraError('')
    setCameraFacing((current) => current === 'user' ? 'environment' : 'user')
  }

  const capturePreview = () => {
    const video = videoRef.current
    const overlay = canvasRef.current
    if (!video?.videoWidth || !video?.videoHeight || !overlay) return
    const captureCanvas = document.createElement('canvas')
    captureCanvas.width = video.videoWidth
    captureCanvas.height = video.videoHeight
    const context = captureCanvas.getContext('2d')
    if (!context) return
    if (cameraFacing === 'user') {
      context.translate(captureCanvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.drawImage(overlay, 0, 0, overlay.width, overlay.height, 0, 0, captureCanvas.width, captureCanvas.height)
    const link = document.createElement('a')
    link.download = `deepali-henna-${design.id}.png`
    link.href = captureCanvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="ar-preview-backdrop" role="presentation">
      <div className="ar-preview" role="dialog" aria-modal="true" aria-label={`Try design ${design.id} on your hand`}>
        <div className="ar-preview-header"><div><p className="eyebrow">Live hand preview</p><h2>Try design {design.id}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close hand preview"><CloseIcon /></button></div>
        <div className="ar-camera-stage">
          <video ref={videoRef} className={cameraFacing === 'user' ? 'is-mirrored' : ''} autoPlay muted playsInline aria-label={`${cameraFacing === 'user' ? 'Front' : 'Back'} camera preview`} />
          <div className={`ar-camera-placeholder${cameraReady ? ' is-ready' : ''}`} aria-hidden="true">{cameraError ? 'Camera unavailable' : cameraState === 'idle' ? 'Start the camera to try this design' : 'Starting camera…'}</div>
          <canvas ref={canvasRef} className="ar-art-canvas" aria-hidden="true" />
          {!cameraError && cameraActive && <p className="ar-tracking-status" role="status">{tracking ? (artError ? artError : artLoading ? 'Hand detected · Loading design' : 'Hand detected') : 'Show one hand to the camera'}</p>}
        </div>
        <div className="ar-preview-controls"><p>The camera tracks your hand and follows its movement, size, and rotation in real time.</p>{cameraError && <p className="ar-preview-error" role="status">{cameraError}</p>}<div className="ar-preview-actions">{!cameraActive ? <button className="whatsapp-button lightbox-ar-button" type="button" onClick={() => { setCameraError(''); setCameraActive(true) }}>Start camera</button> : <><button className="nav-button" type="button" onClick={switchCamera}>Switch camera</button><button className="nav-button" type="button" onClick={stopCamera}>Stop camera</button></>}<button className="nav-button" type="button" onClick={resetPreview}>Reset</button><button className="nav-button" type="button" onClick={capturePreview} disabled={!cameraReady || !tracking}>Save preview</button></div><p className="ar-preview-note">This design uses a palm asset and separate finger assets, each calibrated to hand landmarks. Camera frames stay in this browser.</p></div>
      </div>
    </div>
  )
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (password === adminPassword) {
      sessionStorage.setItem(adminSessionKey, 'active')
      onLogin()
    } else {
      setError('That password does not match. Please try again.')
    }
  }

  return (
    <main className="admin-shell admin-login-shell">
      <div className="admin-login-card">
        <a className="admin-back-link" href="/">← Back to public menu</a>
        <img className="admin-login-logo" src="/deepali-logo-mark.png" alt="" />
        <p className="eyebrow">Artist access</p>
        <h1>Welcome back,<br /><em>Deepali.</em></h1>
        <p className="admin-intro">Sign in to update your collections and keep your design menu fresh.</p>
        <form onSubmit={submit} className="admin-login-form">
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} autoComplete="current-password" autoFocus required />
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit">Open artist dashboard <ArrowIcon /></button>
        </form>
        <p className="admin-security-note">This dashboard is for the artist only.</p>
      </div>
    </main>
  )
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function renumberDesigns(price, designs) {
  return designs.map((design, index) => ({
    ...design,
    id: `${price}-${String(index + 1).padStart(2, '0')}`,
    alt: `Henna design ${price}-${String(index + 1).padStart(2, '0')} from the ${price} dollar collection`,
  }))
}

function AdminDashboard({ onLogout }) {
  const [collections, setCollections] = useState(loadCollections)
  const [selectedPrice, setSelectedPrice] = useState(loadCollections()[0]?.price)
  const [categoryForm, setCategoryForm] = useState({ price: '', description: '' })
  const [notice, setNotice] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingDesignIndex, setEditingDesignIndex] = useState(null)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const touchDrag = useRef(null)
  const importRef = useRef(null)
  const activeCollection = collections.find((collection) => String(collection.price) === String(selectedPrice))
  const editingDesign = activeCollection?.designs[editingDesignIndex]

  const updateCollections = (nextCollections, message = 'Changes saved on this device.') => {
    setCollections(nextCollections)
    saveCollections(nextCollections)
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const addCategory = (event) => {
    event.preventDefault()
    const price = Number(categoryForm.price)
    if (!price || collections.some((collection) => collection.price === price)) return
    const next = [...collections, { price, label: `$${price}`, description: categoryForm.description || 'A new collection by Deepali.', designs: [] }]
      .sort((a, b) => a.price - b.price)
    updateCollections(next, `$${price} collection created.`)
    setSelectedPrice(price)
    setCategoryForm({ price: '', description: '' })
    setShowAddCategory(false)
  }

  const removeCategory = () => {
    if (!categoryToDelete || collections.length === 1) return
    const next = collections.filter((collection) => collection.price !== categoryToDelete.price)
    updateCollections(next, `${categoryToDelete.label} collection removed.`)
    setSelectedPrice(next[0]?.price)
    setCategoryToDelete(null)
  }

  const addImages = async (event) => {
    const files = [...event.target.files]
    if (!files.length || !activeCollection) return
    const newDesigns = await Promise.all(files.map(async (file, index) => {
      const nextNumber = activeCollection.designs.length + index + 1
      return { id: `${activeCollection.price}-${String(nextNumber).padStart(2, '0')}`, src: await fileToDataUrl(file), alt: `Henna design ${activeCollection.price}-${String(nextNumber).padStart(2, '0')} from the ${activeCollection.price} dollar collection` }
    }))
    updateCollections(collections.map((collection) => collection.price === activeCollection.price ? { ...collection, designs: [...collection.designs, ...newDesigns] } : collection), `${newDesigns.length} design${newDesigns.length === 1 ? '' : 's'} added.`)
    event.target.value = ''
  }

  const moveDesign = (index, direction) => {
    const nextDesigns = [...activeCollection.designs]
    const target = index + direction
    if (target < 0 || target >= nextDesigns.length) return
    ;[nextDesigns[index], nextDesigns[target]] = [nextDesigns[target], nextDesigns[index]]
    const renumbered = renumberDesigns(activeCollection.price, nextDesigns)
    updateCollections(collections.map((collection) => collection.price === activeCollection.price ? { ...collection, designs: renumbered } : collection), 'Picture order updated.')
  }

  const removeDesign = (index) => {
    const remaining = renumberDesigns(activeCollection.price, activeCollection.designs.filter((_, designIndex) => designIndex !== index))
    updateCollections(collections.map((collection) => collection.price === activeCollection.price ? { ...collection, designs: remaining } : collection), 'Design removed.')
  }

  const reorderDesign = (fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === toIndex || !activeCollection) {
      setDraggedIndex(null)
      return
    }
    const nextDesigns = [...activeCollection.designs]
    const [movedDesign] = nextDesigns.splice(fromIndex, 1)
    nextDesigns.splice(toIndex, 0, movedDesign)
    const renumbered = renumberDesigns(activeCollection.price, nextDesigns)
    updateCollections(collections.map((collection) => collection.price === activeCollection.price ? { ...collection, designs: renumbered } : collection), 'Picture order updated.')
    setDraggedIndex(null)
  }

  const beginTouchDrag = (index) => {
    touchDrag.current = { from: index, to: index }
    setDraggedIndex(index)
  }

  const updateTouchDrag = (event) => {
    if (!touchDrag.current) return
    event.preventDefault()
    const touchY = event.touches[0]?.clientY
    const rows = [...document.querySelectorAll('.admin-design-row')]
    const targetIndex = rows.findIndex((row) => {
      const bounds = row.getBoundingClientRect()
      return touchY >= bounds.top && touchY <= bounds.bottom
    })
    if (targetIndex >= 0) {
      touchDrag.current.to = targetIndex
      setDraggedIndex(targetIndex)
    }
  }

  const finishTouchDrag = () => {
    if (!touchDrag.current) return
    const { from, to } = touchDrag.current
    touchDrag.current = null
    reorderDesign(from, to)
  }

  const moveDesignToCategory = (targetPrice) => {
    if (editingDesignIndex === null || !editingDesign || targetPrice === activeCollection.price) return
    const targetCollection = collections.find((collection) => collection.price === targetPrice)
    if (!targetCollection) return
    const sourceDesigns = activeCollection.designs.filter((_, index) => index !== editingDesignIndex)
    const nextCollections = collections.map((collection) => {
      if (collection.price === activeCollection.price) return { ...collection, designs: renumberDesigns(collection.price, sourceDesigns) }
      if (collection.price === targetCollection.price) return { ...collection, designs: renumberDesigns(collection.price, [...collection.designs, editingDesign]) }
      return collection
    })
    updateCollections(nextCollections, `Design moved to ${targetCollection.label}.`)
    setSelectedPrice(targetCollection.price)
    setEditingDesignIndex(null)
  }

  const replaceDesign = async (event) => {
    const file = event.target.files?.[0]
    if (!file || editingDesignIndex === null || !activeCollection) return
    const nextSrc = await fileToDataUrl(file)
    const nextDesigns = activeCollection.designs.map((design, index) => index === editingDesignIndex ? { ...design, src: nextSrc } : design)
    updateCollections(collections.map((collection) => collection.price === activeCollection.price ? { ...collection, designs: nextDesigns } : collection), 'Image replaced.')
    setEditingDesignIndex(null)
    event.target.value = ''
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(collections, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'deepali-henna-menu-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = JSON.parse(await file.text())
      if (!Array.isArray(imported) || imported.some((collection) => !collection.price || !Array.isArray(collection.designs))) throw new Error('Invalid backup')
      updateCollections(imported, 'Backup restored.')
      setSelectedPrice(imported[0]?.price)
    } catch {
      setNotice('That backup file could not be read.')
    }
    event.target.value = ''
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="wordmark" href="/"><img className="wordmark-logo" src="/deepali-logo-mark.png" alt="" /><span className="wordmark-label">Ethnic Henna by Deepali</span></a>
        <button className="admin-logout" onClick={() => { sessionStorage.removeItem(adminSessionKey); onLogout() }}>Log out</button>
      </header>
      <section className="admin-content">
        <div className="admin-title-row"><div><p className="eyebrow">Artist dashboard</p><h1>Make it yours,<br /><em>one design at a time.</em></h1></div><span className="admin-status">Saved privately</span></div>
        <p className="admin-intro admin-wide-intro">Choose a collection to add pictures or change their order. Updates are saved on this device.</p>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        <div className="admin-toolbar"><div className="admin-category-tabs" role="tablist" aria-label="Collections">{collections.map((collection) => <button key={collection.price} className={collection.price === activeCollection?.price ? 'is-active' : ''} onClick={() => setSelectedPrice(collection.price)} role="tab" aria-selected={collection.price === activeCollection?.price}>{collection.label}<small>{collection.designs.length} designs</small></button>)}<button className="admin-new-category-tab" onClick={() => setShowAddCategory(true)} aria-label="Create a new category">＋<small>New category</small></button></div><div className="admin-toolbar-actions"><label className="admin-upload-button">+ Add pictures<input type="file" accept="image/*" multiple onChange={addImages} disabled={!activeCollection} /></label></div></div>
        {activeCollection && <section className="admin-collection-panel" aria-labelledby="admin-collection-title"><div className="admin-panel-heading"><div><p className="eyebrow">Editing collection</p><h2 id="admin-collection-title">{activeCollection.label}</h2></div><div className="admin-panel-meta"><span>{activeCollection.designs.length} designs</span><button className="admin-remove-category" onClick={() => setCategoryToDelete(activeCollection)} disabled={collections.length === 1}>Remove category</button></div></div>{activeCollection.designs.length ? <div className="admin-design-list" aria-label="Drag pictures to change their order">{activeCollection.designs.map((design, index) => <article className={`admin-design-row ${draggedIndex === index ? 'is-dragging' : ''}`} key={`${design.id}-${index}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedIndex(index) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); reorderDesign(draggedIndex, index) }} onDragEnd={() => setDraggedIndex(null)} onTouchStart={() => beginTouchDrag(index)} onTouchMove={updateTouchDrag} onTouchEnd={finishTouchDrag}><button className="admin-design-thumb" onClick={() => setEditingDesignIndex(index)} aria-label={`Open options for ${design.id}`}><img src={design.src} alt="" /><span>Tap to edit</span></button><div className="admin-design-info"><strong>{design.id}</strong><span>Position {index + 1} · Drag to reorder</span></div><div className="admin-row-actions"><button onClick={() => moveDesign(index, -1)} disabled={index === 0} aria-label={`Move ${design.id} up`}>↑</button><button onClick={() => moveDesign(index, 1)} disabled={index === activeCollection.designs.length - 1} aria-label={`Move ${design.id} down`}>↓</button><button className="admin-remove" onClick={() => setEditingDesignIndex(index)} aria-label={`Open options for ${design.id}`}>×</button></div></article>)}</div> : <div className="admin-empty"><p>No designs here yet.</p><label className="admin-primary-button">Choose pictures<input type="file" accept="image/*" multiple onChange={addImages} /></label></div>}</section>}
        <section className="admin-backups"><div><p className="eyebrow">Keep a copy</p><h2>Backup your menu</h2><p>Download your changes before switching devices.</p></div><div className="admin-backup-actions"><button className="admin-secondary-button" onClick={exportBackup}>Download backup</button><button className="admin-text-button" onClick={() => importRef.current?.click()}>Restore backup</button><input ref={importRef} type="file" accept="application/json" onChange={importBackup} /></div></section>
      </section>
      {showAddCategory && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddCategory(false) }}><div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="add-category-title"><button className="admin-dialog-close" onClick={() => setShowAddCategory(false)} aria-label="Close new category form">×</button><p className="eyebrow">Grow your menu</p><h2 id="add-category-title">Create a new category</h2><form className="admin-category-dialog-form" onSubmit={addCategory}><label>Price<input type="number" min="1" step="1" placeholder="30" value={categoryForm.price} onChange={(event) => setCategoryForm({ ...categoryForm, price: event.target.value })} required /></label><label>Description <span>(optional)</span><input type="text" placeholder="Detailed designs for special occasions" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label><div className="admin-dialog-actions"><button className="admin-secondary-button" type="button" onClick={() => setShowAddCategory(false)}>Cancel</button><button className="admin-primary-button" type="submit">Create category <ArrowIcon /></button></div></form></div></div>}
      {categoryToDelete && <div className="admin-dialog-backdrop" role="presentation"><div className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-category-title" aria-describedby="delete-category-description"><p className="eyebrow">Please confirm</p><h2 id="delete-category-title">Remove {categoryToDelete.label}?</h2><p id="delete-category-description">This will remove the category and all {categoryToDelete.designs.length} design{categoryToDelete.designs.length === 1 ? '' : 's'} inside it. This action cannot be undone unless you restore a backup.</p><div className="admin-dialog-actions"><button className="admin-secondary-button" onClick={() => setCategoryToDelete(null)}>Keep category</button><button className="admin-danger-button" onClick={removeCategory}>Remove category</button></div></div></div>}
      {editingDesign && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingDesignIndex(null) }}><div className="admin-image-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-image-title"><button className="admin-dialog-close" onClick={() => setEditingDesignIndex(null)} aria-label="Close image options">×</button><img src={editingDesign.src} alt={editingDesign.alt} /><div className="admin-image-dialog-body"><p className="eyebrow">Design {editingDesign.id}</p><h2 id="edit-image-title">Picture options</h2><label className="admin-option-row"><span>Move to another category</span><select value={activeCollection.price} onChange={(event) => moveDesignToCategory(Number(event.target.value))}>{collections.map((collection) => <option key={collection.price} value={collection.price}>{collection.label}</option>)}</select></label><label className="admin-option-button">Replace image<input type="file" accept="image/*" onChange={replaceDesign} /></label><button className="admin-danger-button admin-full-button" onClick={() => { removeDesign(editingDesignIndex); setEditingDesignIndex(null) }}>Remove image</button></div></div></div>}
    </main>
  )
}

function LandingPage() {
  const portfolio = portfolioData()
  const servicesWhatsApp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Deepali, I would like to inquire about your henna services.')}`

  return (
    <div className="landing-page home-page">
      <PublicNav />
      <main>
        <section className="landing-hero"><picture className="landing-hero-background-picture"><source type="image/webp" srcSet="/optimized/ethnic-henna-hero.webp" /><img className="landing-hero-background" src="/ethnic-henna-hero.png" alt="Hand with intricate henna and delicate rose-gold details" width="1600" height="1600" fetchPriority="high" decoding="async" /></picture><div className="landing-hero-copy"><p className="eyebrow">Ethnic Henna by Deepali</p><h1>Henna artist in San Ramon<br /><em>for moments that matter.</em></h1><p className="landing-hero-intro">Ethnic Henna creates thoughtful mehndi for bridal stories, celebrations, and gatherings in San Ramon and throughout the Bay Area.</p><div className="landing-hero-actions"><a className="landing-primary-cta" href="/work">View portfolio <ArrowIcon /></a><a className="landing-secondary-cta" href="/bridal">View bridal pricing</a></div></div></section>
        <section className="landing-portfolio" id="portfolio"><div className="landing-section-heading"><div><p className="eyebrow">A curated portfolio</p><h2>Find the feeling<br /><em>you want to wear.</em></h2></div><div className="landing-portfolio-heading-side"><p className="landing-portfolio-note">A selection of Deepali’s finest work.</p><a className="landing-inline-link" href="/work">View all portfolio work <ArrowIcon /></a></div></div><div className="landing-portfolio-grid">{portfolio.map((design) => <div className="landing-portfolio-tile" key={design.id}><PortfolioImage design={design} /></div>)}</div></section>
        <section className="landing-services"><div className="landing-services-copy"><p className="eyebrow">Services by Ethnic Henna</p><h2>Art for every<br /><em>kind of gathering.</em></h2><p>From intimate celebrations to full bridal stories, every design is drawn with care and shaped around the moment, the people, and the feeling you want to remember.</p><p className="service-area-copy">Based in San Ramon, Ethnic Henna serves bridal celebrations, parties, and custom gatherings across the Bay Area.</p><a className="landing-light-cta" href={servicesWhatsApp} target="_blank" rel="noreferrer">Ask about your occasion <ArrowIcon /></a></div><div className="landing-service-list"><div><span>01</span><strong>Bridal henna</strong><small>Custom coverage for your day</small></div><div><span>02</span><strong>Parties & celebrations</strong><small>Beautiful details for every guest</small></div><div><span>03</span><strong>Group events</strong><small>Memorable art for shared occasions</small></div></div></section>
        <section className="landing-final-cta"><p className="eyebrow">Your story starts here</p><h2>Let’s make it<br /><em>beautifully yours.</em></h2><a className="landing-primary-cta" href="/designs">Browse the design menu <ArrowIcon /></a></section>
      </main>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
    </div>
  )
}

function BridalPage() {
  const bridalPackages = [['Length 1', '$250'], ['Length 2', '$350'], ['Length 3', '$480'], ['Length 4', '$580'], ['Length 5', '$680']]
  const bridalWhatsApp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Deepali, I would like to inquire about bridal henna packages.')}`

  return (
    <div className="bridal-page landing-page">
      <PublicNav current="bridal" />
      <main>
        <section className="public-hero bridal-hero"><img className="public-hero-background" src="/bridal-hero.png" alt="Bridal hands decorated with intricate henna" loading="eager" fetchPriority="high" decoding="async" /><div className="public-hero-copy"><p className="eyebrow">Premium bridal henna</p><h1>A crowning detail<br /><em>for your day.</em></h1><p>Customized, intricate henna designed around your ceremony, your vision, and the story you want to carry with you in San Ramon and throughout the Bay Area.</p><a className="landing-primary-cta" href={bridalWhatsApp} target="_blank" rel="noreferrer">Start a bridal conversation <ArrowIcon /></a></div></section>
        <section className="bridal-service-rate"><div><p className="eyebrow">Bridal service</p><h2>Thoughtful coverage,<br /><em>beautifully considered.</em></h2></div><div className="bridal-rate-number"><span>Bridal service</span><strong>$120</strong><p>per hour + travel</p></div></section>
        <section className="bridal-packages"><div className="bridal-heading"><div><p className="eyebrow">Choose your coverage</p><h2>Made to meet<br /><em>your moment.</em></h2></div><p>Each length is a starting point for a custom conversation. We’ll shape the final design around your preferences and celebration.</p></div><div className="bridal-package-layout"><div className="bridal-illustration"><img src="/bridal-lengths.png" alt="Hand and arm illustrations showing bridal henna coverage lengths one through five" /><p>Coverage guide · Lengths 1–5</p></div><div className="bridal-pricing" aria-label="Bridal henna package pricing">{bridalPackages.map(([length, price]) => <div className="bridal-price-row" key={length}><span>{length}</span><strong>{price}</strong></div>)}<p className="bridal-pricing-note">Final pricing is confirmed after discussing your design, coverage, and event details.</p></div></div></section>
        <section className="landing-final-cta"><p className="eyebrow">Your bridal story starts here</p><h2>Let’s make it<br /><em>beautifully yours.</em></h2><a className="landing-primary-cta" href={bridalWhatsApp} target="_blank" rel="noreferrer">Inquire on WhatsApp <ArrowIcon /></a></section>
      </main>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
    </div>
  )
}

function WorkPage() {
  const portfolio = portfolioData()
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    if (!selectedImage) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedImage(null)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedImage])

  return (
    <div className="work-detail-page landing-page">
      <PublicNav current="work" />
      <main>
        <section className="public-hero work-detail-hero"><img className="public-hero-background" src="/work-hero.png" alt="Detailed henna work on a hand" loading="eager" fetchPriority="high" decoding="async" /><div className="public-hero-copy"><p className="eyebrow">The Ethnic Henna portfolio</p><h1>Work that carries<br /><em>the moment.</em></h1><p>A closer look at Deepali’s curated henna work, from intimate details to full bridal artistry.</p><a className="landing-primary-cta" href="#portfolio-work">View the portfolio <ArrowIcon /></a></div></section>
        <section className="work-detail-gallery" id="portfolio-work" aria-label="Curated portfolio gallery">{portfolio.map((design, index) => <figure className="work-detail-photo" key={design.id}><button className="work-detail-photo-button" onClick={() => setSelectedImage(design)} aria-label={`Open ${design.alt}`}><PortfolioImage design={design} loading={index > 2 ? 'lazy' : 'eager'} /></button></figure>)}</section>
        <section className="work-detail-cta"><p className="eyebrow">Looking for your own?</p><h2>Let’s create something<br /><em>beautifully yours.</em></h2><div><a className="landing-primary-cta" href="/designs">Design by Pricing <ArrowIcon /></a><a className="landing-secondary-cta" href="/bridal">Explore bridal work</a></div></section>
      </main>
      {selectedImage && <div className="work-image-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedImage(null) }}><div className="work-image-dialog" role="dialog" aria-modal="true" aria-label={selectedImage.alt}><button className="work-image-close" onClick={() => setSelectedImage(null)} autoFocus aria-label="Close image preview">×</button><img src={selectedImage.src} alt={selectedImage.alt} /></div></div>}
      <footer className="landing-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
    </div>
  )
}

function EventsPage() {
  const eventsWhatsApp = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi Deepali, I would like to inquire about henna for my event.')}`
  return (
    <div className="events-page landing-page">
      <PublicNav current="events" />
      <main>
        <section className="public-hero events-hero"><img className="public-hero-background" src="/events-hero.png" alt="Henna decorated hands ready for a celebration" loading="eager" fetchPriority="high" decoding="async" /><div className="public-hero-copy"><p className="eyebrow">Parties · celebrations · group events</p><h1>Make room for<br /><em>the joyful details.</em></h1><p>Ethnic Henna brings thoughtful, personalized henna to weddings, birthdays, parties, and group celebrations in San Ramon and across the Bay Area.</p><a className="landing-primary-cta" href={eventsWhatsApp} target="_blank" rel="noreferrer">Inquire about your event <ArrowIcon /></a></div></section>
        <section className="events-overview"><div><p className="eyebrow">A personalized experience</p><h2>Every guest leaves<br /><em>with a memento.</em></h2></div><p>Beyond individual sessions, Deepali creates a sophisticated experience for your guests, ensuring that each design feels personal and each celebration feels beautifully considered.</p></section>
        <section className="events-rate-section"><div className="events-rate-copy"><p className="eyebrow">Hourly event service</p><h2>Bring Ethnic Henna<br /><em>to your occasion.</em></h2><p>For regular events such as weddings, birthdays, parties, and group gatherings, pricing is based on the time needed for your event, plus travel. Contact Deepali for a quote tailored to your celebration.</p><a className="landing-light-cta" href={eventsWhatsApp} target="_blank" rel="noreferrer">Discuss your event details <ArrowIcon /></a></div><div className="events-rate-card"><span>Event pricing</span><strong>By<br />inquiry</strong><p>Hourly service + travel</p></div></section>
        <section className="events-list-section"><p className="eyebrow">Great for</p><div className="events-list"><span><b>01</b> Weddings</span><span><b>02</b> Birthdays</span><span><b>03</b> Parties</span><span><b>04</b> Group celebrations</span></div></section>
        <section className="landing-final-cta"><p className="eyebrow">Plan something memorable</p><h2>Let’s create a<br /><em>beautiful gathering.</em></h2><a className="landing-primary-cta" href={eventsWhatsApp} target="_blank" rel="noreferrer">Start an event inquiry <ArrowIcon /></a></section>
      </main>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
    </div>
  )
}

function App() {
  const [collections, setCollections] = useState(loadCollections)
  const [activePrice, setActivePrice] = useState(null)
  const [selected, setSelected] = useState(null)
  const galleryRef = useRef(null)

  const selectCollection = (price) => { setActivePrice(price); requestAnimationFrame(() => galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  const activeCollection = collections.find((collection) => collection.price === activePrice)
  const openDesign = (collection, index) => setSelected({ collection, index, design: collection.designs[index] })
  const moveDesign = (step) => setSelected((current) => { if (!current) return current; const nextIndex = (current.index + step + current.collection.designs.length) % current.collection.designs.length; return { ...current, index: nextIndex, design: current.collection.designs[nextIndex] } })

  return (
    <div className="designs-page landing-page">
      <PublicNav current="pricing" />
      <main id="top">
        <section className="public-hero designs-hero"><img className="public-hero-background" src="/designs-hero.png" alt="Intricate henna designs on hands" loading="eager" fetchPriority="high" decoding="async" /><div className="public-hero-copy"><p className="eyebrow">Design by pricing</p><h1>Find a design<br /><em>that feels like you.</em></h1><p>A curated collection of handpicked henna designs, arranged by price and ready for your next celebration.</p><a href="#collections" className="landing-primary-cta">Browse the collections <ArrowIcon /></a></div></section>
        <section className="collections-section" id="collections"><div className="section-heading"><div><p className="eyebrow">Choose your collection</p><h2>Three ways to wear<br /><em>your story.</em></h2></div><p>Start with a price point, then tap any design to see it up close.</p></div><div className="collection-grid">{collections.map((collection) => <CollectionCard key={collection.price} collection={collection} onSelect={selectCollection} />)}</div></section>
        {activeCollection && <section className="gallery-section gallery-enter" ref={galleryRef} id="gallery" aria-labelledby="gallery-title"><div className="gallery-heading"><div><p className="eyebrow">Your selection</p><h2 id="gallery-title">The {activeCollection.label} collection</h2></div><button className="change-collection" onClick={() => { setActivePrice(null); document.querySelector('#collections')?.scrollIntoView({ behavior: 'smooth' }) }}>Change price <span>↗</span></button></div><div className="gallery-grid">{activeCollection.designs.map((design, index) => <button className="design-tile" key={design.id} onClick={() => openDesign(activeCollection, index)} aria-label={`Open design ${design.id}, ${activeCollection.label}`}><img src={design.src} alt={design.alt} loading="lazy" /><span className="design-number">{design.id}</span><span className="view-design">View <ArrowIcon /></span></button>)}</div></section>}
        <section className="closing-section"><div className="closing-mark">✦</div><p className="eyebrow">The final touch</p><h2>Found one<br /><em>you love?</em></h2><p>Send Deepali the design number on WhatsApp and start your conversation.</p><a className="whatsapp-button whatsapp-button-dark" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><WhatsAppIcon /> Say hello on WhatsApp</a></section>
      </main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
      {selected && <Lightbox selected={selected} onClose={() => setSelected(null)} onPrevious={() => moveDesign(-1)} onNext={() => moveDesign(1)} />}
    </div>
  )
}

const pageKey = getPageKey(window.location.pathname, window.location.hash)
applySeoMetadata(pageKey)
const isAdminRoute = pageKey === 'admin'
const isDesignsRoute = pageKey === 'designs'
const isBridalRoute = pageKey === 'bridal'
const isEventsRoute = pageKey === 'events'
const isWorkRoute = pageKey === 'work'
const isHomeRoute = pageKey === 'home'
createRoot(document.getElementById('root')).render(<StrictMode>{isAdminRoute ? <AdminRoute /> : isDesignsRoute ? <App /> : isBridalRoute ? <BridalPage /> : isEventsRoute ? <EventsPage /> : isWorkRoute ? <WorkPage /> : isHomeRoute ? <LandingPage /> : <LandingPage />}</StrictMode>)

function AdminRoute() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(adminSessionKey) === 'active')
  return authenticated ? <AdminDashboard onLogout={() => setAuthenticated(false)} /> : <AdminLogin onLogin={() => setAuthenticated(true)} />
}
