import React, { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const imageFiles = {
  15: ['IMG_0579.jpg', 'IMG_1073.jpg', 'IMG_1566.jpg', 'IMG_3456.jpg', 'IMG_3457.jpg', 'IMG_3514.jpg', 'IMG_4387.jpg', 'IMG_4631.jpg', 'IMG_5205.jpg', 'IMG_5901.jpg', 'IMG_6011.jpg', 'IMG_8020.jpg', 'IMG_9332.jpg'],
  20: ['IMG_0446.jpg', 'IMG_0298.jpg', 'IMG_0445.jpg', 'IMG_0641.jpg', 'IMG_0845.jpg', 'IMG_0847.jpg', 'IMG_0849.jpg', 'IMG_2640.jpg', 'IMG_2878.jpg', 'IMG_3047.jpg', 'IMG_5083.jpg', 'IMG_5084.jpg', 'IMG_9821.jpg'],
  25: ['IMG_0331.jpg', 'IMG_1001.jpg', 'IMG_1183.jpg', 'IMG_2267.jpg', 'IMG_2555.jpg', 'IMG_2640.jpg', 'IMG_3595.jpg', 'IMG_8102.jpg', 'IMG_9089.jpg', 'IMG_9819.jpg'],
}

const initialCollections = Object.entries(imageFiles).map(([price, files]) => ({
  price: Number(price),
  label: `$${price}`,
  description: price === '15' ? 'Beautiful essentials for a first look.' : price === '20' ? 'A little more detail for your next celebration.' : 'Signature designs made to leave an impression.',
  designs: files.map((file, index) => ({
    id: `${price}-${String(index + 1).padStart(2, '0')}`,
    src: `./${price}/${file}`,
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
const websiteUrl = 'https://ethnic-henna-design.vercel.app/'
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
        <a className="admin-back-link" href="./">← Back to public menu</a>
        <img className="admin-login-logo" src="./deepali-logo-mark.png" alt="" />
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
  const [touchOffset, setTouchOffset] = useState(0)
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
    touchDrag.current = { from: index, to: index, startY: null }
    setDraggedIndex(index)
  }

  const updateTouchDrag = (event) => {
    if (!touchDrag.current) return
    event.preventDefault()
    const touchY = event.touches[0]?.clientY
    if (touchDrag.current.startY === null) touchDrag.current.startY = touchY
    setTouchOffset(touchY - touchDrag.current.startY)
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
    setTouchOffset(0)
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
        <a className="wordmark" href="./"><img className="wordmark-logo" src="./deepali-logo-mark.png" alt="" /><span className="wordmark-label">Ethnic Henna by Deepali</span></a>
        <button className="admin-logout" onClick={() => { sessionStorage.removeItem(adminSessionKey); onLogout() }}>Log out</button>
      </header>
      <section className="admin-content">
        <div className="admin-title-row"><div><p className="eyebrow">Artist dashboard</p><h1>Make it yours,<br /><em>one design at a time.</em></h1></div><span className="admin-status">Saved privately</span></div>
        <p className="admin-intro admin-wide-intro">Choose a collection to add pictures or change their order. Updates are saved on this device.</p>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        <div className="admin-toolbar"><div className="admin-category-tabs" role="tablist" aria-label="Collections">{collections.map((collection) => <button key={collection.price} className={collection.price === activeCollection?.price ? 'is-active' : ''} onClick={() => setSelectedPrice(collection.price)} role="tab" aria-selected={collection.price === activeCollection?.price}>{collection.label}<small>{collection.designs.length} designs</small></button>)}<button className="admin-new-category-tab" onClick={() => setShowAddCategory(true)} aria-label="Create a new category">＋<small>New category</small></button></div><div className="admin-toolbar-actions"><label className="admin-upload-button">+ Add pictures<input type="file" accept="image/*" multiple onChange={addImages} disabled={!activeCollection} /></label></div></div>
        {activeCollection && <section className="admin-collection-panel" aria-labelledby="admin-collection-title"><div className="admin-panel-heading"><div><p className="eyebrow">Editing collection</p><h2 id="admin-collection-title">{activeCollection.label}</h2></div><div className="admin-panel-meta"><span>{activeCollection.designs.length} designs</span><button className="admin-remove-category" onClick={() => setCategoryToDelete(activeCollection)} disabled={collections.length === 1}>Remove category</button></div></div>{activeCollection.designs.length ? <div className="admin-design-list" aria-label="Drag cards to change their order">{activeCollection.designs.map((design, index) => <article className={`admin-design-row ${draggedIndex === index ? 'is-dragging' : ''}`} style={draggedIndex === index && touchDrag.current ? { transform: `translateY(${touchOffset}px) scale(1.02)` } : undefined} key={`${design.id}-${index}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedIndex(index) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => { event.preventDefault(); reorderDesign(draggedIndex, index) }} onDragEnd={() => setDraggedIndex(null)} onTouchStart={() => beginTouchDrag(index)} onTouchMove={updateTouchDrag} onTouchEnd={finishTouchDrag}><button className="admin-design-thumb" onClick={() => setEditingDesignIndex(index)} aria-label={`Open options for ${design.id}`}><img src={design.src} alt="" /><span>Tap to edit</span></button><div className="admin-design-info"><strong>{design.id}</strong><span>Position {index + 1}</span><small>Drag card to reorder</small></div><div className="admin-row-actions"><button onClick={() => moveDesign(index, -1)} disabled={index === 0} aria-label={`Move ${design.id} up`}>↑</button><button onClick={() => moveDesign(index, 1)} disabled={index === activeCollection.designs.length - 1} aria-label={`Move ${design.id} down`}>↓</button><button className="admin-remove" onClick={() => setEditingDesignIndex(index)} aria-label={`Open options for ${design.id}`}>×</button></div></article>)}</div> : <div className="admin-empty"><p>No designs here yet.</p><label className="admin-primary-button">Choose pictures<input type="file" accept="image/*" multiple onChange={addImages} /></label></div>}</section>}
        <section className="admin-backups"><div><p className="eyebrow">Keep a copy</p><h2>Backup your menu</h2><p>Download your changes before switching devices.</p></div><div className="admin-backup-actions"><button className="admin-secondary-button" onClick={exportBackup}>Download backup</button><button className="admin-text-button" onClick={() => importRef.current?.click()}>Restore backup</button><input ref={importRef} type="file" accept="application/json" onChange={importBackup} /></div></section>
      </section>
      {showAddCategory && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddCategory(false) }}><div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="add-category-title"><button className="admin-dialog-close" onClick={() => setShowAddCategory(false)} aria-label="Close new category form">×</button><p className="eyebrow">Grow your menu</p><h2 id="add-category-title">Create a new category</h2><form className="admin-category-dialog-form" onSubmit={addCategory}><label>Price<input type="number" min="1" step="1" placeholder="30" value={categoryForm.price} onChange={(event) => setCategoryForm({ ...categoryForm, price: event.target.value })} required /></label><label>Description <span>(optional)</span><input type="text" placeholder="Detailed designs for special occasions" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label><div className="admin-dialog-actions"><button className="admin-secondary-button" type="button" onClick={() => setShowAddCategory(false)}>Cancel</button><button className="admin-primary-button" type="submit">Create category <ArrowIcon /></button></div></form></div></div>}
      {categoryToDelete && <div className="admin-dialog-backdrop" role="presentation"><div className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-category-title" aria-describedby="delete-category-description"><p className="eyebrow">Please confirm</p><h2 id="delete-category-title">Remove {categoryToDelete.label}?</h2><p id="delete-category-description">This will remove the category and all {categoryToDelete.designs.length} design{categoryToDelete.designs.length === 1 ? '' : 's'} inside it. This action cannot be undone unless you restore a backup.</p><div className="admin-dialog-actions"><button className="admin-secondary-button" onClick={() => setCategoryToDelete(null)}>Keep category</button><button className="admin-danger-button" onClick={removeCategory}>Remove category</button></div></div></div>}
      {editingDesign && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingDesignIndex(null) }}><div className="admin-image-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-image-title"><button className="admin-dialog-close" onClick={() => setEditingDesignIndex(null)} aria-label="Close image options">×</button><img src={editingDesign.src} alt={editingDesign.alt} /><div className="admin-image-dialog-body"><p className="eyebrow">Design {editingDesign.id}</p><h2 id="edit-image-title">Picture options</h2><label className="admin-option-row"><span>Move to another category</span><select value={activeCollection.price} onChange={(event) => moveDesignToCategory(Number(event.target.value))}>{collections.map((collection) => <option key={collection.price} value={collection.price}>{collection.label}</option>)}</select></label><label className="admin-option-button">Replace image<input type="file" accept="image/*" onChange={replaceDesign} /></label><button className="admin-danger-button admin-full-button" onClick={() => { removeDesign(editingDesignIndex); setEditingDesignIndex(null) }}>Remove image</button></div></div></div>}
    </main>
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
    <>
      <header className="site-header"><a className="wordmark" href="#top" aria-label="Ethnic Henna by Deepali home"><img className="wordmark-logo" src="./deepali-logo-mark.png" alt="" /><span className="wordmark-label">Ethnic Henna by Deepali</span></a><a className="header-whatsapp" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><WhatsAppIcon /> <span>WhatsApp</span></a></header>
      <main id="top">
        <section className="hero"><div className="hero-copy"><h1 className="reveal reveal-delay-1">Find a design<br /><em>that feels like you.</em></h1><p className="hero-intro reveal reveal-delay-2">A curated collection of handpicked henna designs, arranged by price and ready for your next celebration.</p><a href="#collections" className="hero-link reveal reveal-delay-3">Browse the collections <ArrowIcon /></a></div><div className="hero-photo reveal reveal-delay-2"><img src="./deepali-hero-frame.png" alt="Decorative henna ribbon frame for Deepali Henna Artist" /></div></section>
        <section className="collections-section" id="collections"><div className="section-heading"><div><p className="eyebrow">Choose your collection</p><h2>Three ways to wear<br /><em>your story.</em></h2></div><p>Start with a price point, then tap any design to see it up close.</p></div><div className="collection-grid">{collections.map((collection) => <CollectionCard key={collection.price} collection={collection} onSelect={selectCollection} />)}</div></section>
        {activeCollection && <section className="gallery-section gallery-enter" ref={galleryRef} id="gallery" aria-labelledby="gallery-title"><div className="gallery-heading"><div><p className="eyebrow">Your selection</p><h2 id="gallery-title">The {activeCollection.label} collection</h2></div><button className="change-collection" onClick={() => { setActivePrice(null); document.querySelector('#collections')?.scrollIntoView({ behavior: 'smooth' }) }}>Change price <span>↗</span></button></div><div className="gallery-grid">{activeCollection.designs.map((design, index) => <button className="design-tile" key={design.id} onClick={() => openDesign(activeCollection, index)} aria-label={`Open design ${design.id}, ${activeCollection.label}`}><img src={design.src} alt={design.alt} loading="lazy" /><span className="design-number">{design.id}</span><span className="view-design">View <ArrowIcon /></span></button>)}</div></section>}
        <section className="closing-section"><div className="closing-mark">✦</div><p className="eyebrow">The final touch</p><h2>Found one<br /><em>you love?</em></h2><p>Send Deepali the design number on WhatsApp and start your conversation.</p><a className="whatsapp-button whatsapp-button-dark" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer"><WhatsAppIcon /> Say hello on WhatsApp</a></section>
      </main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} Deepali Henna Artist</span><span>Ethnic. Henna by Deepali</span></footer>
      {selected && <Lightbox selected={selected} onClose={() => setSelected(null)} onPrevious={() => moveDesign(-1)} onNext={() => moveDesign(1)} />}
    </>
  )
}

const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin' || window.location.hash === '#admin'
createRoot(document.getElementById('root')).render(<StrictMode>{isAdminRoute ? <AdminRoute /> : <App />}</StrictMode>)

function AdminRoute() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(adminSessionKey) === 'active')
  return authenticated ? <AdminDashboard onLogout={() => setAuthenticated(false)} /> : <AdminLogin onLogin={() => setAuthenticated(true)} />
}
