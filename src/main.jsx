import React, { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const imageFiles = {
  15: ['IMG_0446.jpg', 'IMG_0579.jpg', 'IMG_1073.jpg', 'IMG_1566.jpg', 'IMG_3456.jpg', 'IMG_3457.jpg', 'IMG_3514.jpg', 'IMG_4387.jpg', 'IMG_4631.jpg', 'IMG_5205.jpg', 'IMG_5901.jpg', 'IMG_6011.jpg', 'IMG_8020.jpg', 'IMG_9332.jpg'],
  20: ['IMG_0298.jpg', 'IMG_0445.jpg', 'IMG_0641.jpg', 'IMG_0845.jpg', 'IMG_0847.jpg', 'IMG_0849.jpg', 'IMG_2640.jpg', 'IMG_2878.jpg', 'IMG_3047.jpg', 'IMG_5083.jpg', 'IMG_5084.jpg', 'IMG_9821.jpg'],
  25: ['IMG_0331.jpg', 'IMG_1001.jpg', 'IMG_1183.jpg', 'IMG_2267.jpg', 'IMG_2555.jpg', 'IMG_2640.jpg', 'IMG_3595.jpg', 'IMG_8102.jpg', 'IMG_9089.jpg', 'IMG_9819.jpg'],
}

const collections = Object.entries(imageFiles).map(([price, files]) => ({
  price: Number(price),
  label: `$${price}`,
  description: price === '15' ? 'Beautiful essentials for a first look.' : price === '20' ? 'A little more detail for your next celebration.' : 'Signature designs made to leave an impression.',
  designs: files.map((file, index) => ({
    id: `${price}-${String(index + 1).padStart(2, '0')}`,
    src: `./${price}/${file}`,
    alt: `Henna design ${price}-${String(index + 1).padStart(2, '0')} from the ${price} dollar collection`,
  })),
}))

const whatsappNumber = '15103408849'
const whatsappMessage = (design, imageUrl) => encodeURIComponent(`Hi Deepali, I’m interested in design ${design.id} from the $${design.price} collection.\n\nImage: ${imageUrl}`)

function ArrowIcon({ direction = 'right' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`icon icon-${direction}`}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d="M6 6l12 12M18 6L6 18" /></svg>
}

function WhatsAppIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="whatsapp-icon"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.5 4.1 1.6 5.9L.2 24l6.5-1.7a11.8 11.8 0 0 0 5.4 1.3h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.3-6.1-3.5-8.3ZM12.1 21.6c-1.7 0-3.4-.5-4.8-1.4l-.3-.2-3.9 1 1-3.8-.2-.4a9.8 9.8 0 1 1 8.2 4.8Zm5.4-7.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-1.7-.8-2.8-1.4-3.9-3.2-.3-.5.3-.5.8-1.6.1-.3.1-.5 0-.7-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.3 1.4.5 1.9.7.8.3 1.5.2 2 .1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.1-1.3-.2-.2-.4-.3-.7-.4Z" /></svg>
}

function CollectionCard({ collection, onSelect }) {
  return (
    <button className="collection-card" onClick={() => onSelect(collection.price)} aria-label={`View ${collection.label} collection`}>
      <span className="collection-image-wrap"><img src={collection.designs[0].src} alt="" loading="lazy" /></span>
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
        <div className="lightbox-details"><div><span className="eyebrow">Design {selected.design.id}</span><h2>{selected.collection.label} collection</h2></div><a className="whatsapp-button" href={whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon /> Send it to artist</a></div>
        <div className="lightbox-nav"><button className="nav-button" onClick={onPrevious} aria-label="Previous design"><ArrowIcon direction="left" /> Previous</button><button className="nav-button" onClick={onNext} aria-label="Next design">Next <ArrowIcon /></button></div>
      </div>
    </div>
  )
}

function App() {
  const [activePrice, setActivePrice] = useState(null)
  const [selected, setSelected] = useState(null)
  const galleryRef = useRef(null)

  const selectCollection = (price) => { setActivePrice(price); requestAnimationFrame(() => galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }
  const activeCollection = collections.find((collection) => collection.price === activePrice)
  const openDesign = (collection, index) => setSelected({ collection, index, design: collection.designs[index] })
  const moveDesign = (step) => setSelected((current) => { if (!current) return current; const nextIndex = (current.index + step + current.collection.designs.length) % current.collection.designs.length; return { ...current, index: nextIndex, design: current.collection.designs[nextIndex] } })

  return (
    <>
      <header className="site-header"><a className="wordmark" href="#top" aria-label="Ethnic Henna by Deepali home"><span className="wordmark-mark">E</span><span><strong>Deepali</strong><small>Henna Artist</small></span></a><a className="header-whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><WhatsAppIcon /> <span>WhatsApp</span></a></header>
      <main id="top">
        <section className="hero"><div className="hero-copy"><p className="eyebrow reveal">Ethnic. Henna by Deepali</p><h1 className="reveal reveal-delay-1">Find a design<br /><em>that feels like you.</em></h1><p className="hero-intro reveal reveal-delay-2">A curated collection of handpicked henna designs, arranged by price and ready for your next celebration.</p><a href="#collections" className="hero-link reveal reveal-delay-3">Browse the collections <ArrowIcon /></a></div><div className="hero-photo reveal reveal-delay-2"><img src="./25/IMG_0331.jpg" alt="Henna design from Deepali's portfolio" /><span>Deepali's portfolio</span></div></section>
        <section className="collections-section" id="collections"><div className="section-heading"><div><p className="eyebrow">Choose your collection</p><h2>Three ways to wear<br /><em>your story.</em></h2></div><p>Start with a price point, then tap any design to see it up close.</p></div><div className="collection-grid">{collections.map((collection) => <CollectionCard key={collection.price} collection={collection} onSelect={selectCollection} />)}</div></section>
        {activeCollection && <section className="gallery-section" ref={galleryRef} id="gallery" aria-labelledby="gallery-title"><div className="gallery-heading"><div><p className="eyebrow">Your selection</p><h2 id="gallery-title">The {activeCollection.label} collection</h2></div><button className="change-collection" onClick={() => { setActivePrice(null); document.querySelector('#collections')?.scrollIntoView({ behavior: 'smooth' }) }}>Change price <span>↗</span></button></div><div className="gallery-grid">{activeCollection.designs.map((design, index) => <button className="design-tile" key={design.id} onClick={() => openDesign(activeCollection, index)} aria-label={`Open design ${design.id}, ${activeCollection.label}`}><img src={design.src} alt={design.alt} loading="lazy" /><span className="design-number">{design.id}</span><span className="view-design">View <ArrowIcon /></span></button>)}</div></section>}
        <section className="closing-section"><div className="closing-mark">✦</div><p className="eyebrow">The final touch</p><h2>Found one<br /><em>you love?</em></h2><p>Send Deepali the design number on WhatsApp and start your conversation.</p><a className="whatsapp-button whatsapp-button-dark" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><WhatsAppIcon /> Say hello on WhatsApp</a></section>
      </main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
      {selected && <Lightbox selected={selected} onClose={() => setSelected(null)} onPrevious={() => moveDesign(-1)} onNext={() => moveDesign(1)} />}
    </>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
