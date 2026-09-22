export const SITE_ORIGIN = 'https://ethnic-henna-design.vercel.app'

const serviceAreas = [
  { '@type': 'City', name: 'San Ramon' },
  { '@type': 'Place', name: 'San Francisco Bay Area' },
]

export const seoPages = {
  home: {
    path: '/',
    title: 'Henna Artist in San Ramon, CA | Ethnic Henna',
    description: 'Professional henna artist in San Ramon serving bridal celebrations, weddings, parties, and custom henna appointments throughout the Bay Area.',
    h1: 'Henna for brides and celebrations.',
    image: '/home-hero-desktop.jpg',
    imageAlt: 'Crossed hands with detailed henna against a mustard outfit',
    robots: 'index,follow',
  },
  work: {
    path: '/work',
    title: 'Henna Design Portfolio | Ethnic Henna',
    description: 'Explore Ethnic Henna’s real portfolio of detailed bridal, celebration, and custom henna work by Deepali in San Ramon and the Bay Area.',
    h1: 'Selected henna from recent work.',
    image: '/work-hero-desktop.jpg',
    imageAlt: 'Raised henna-adorned hands against marigold garlands, brass lamps, and ceremony light',
    robots: 'index,follow',
  },
  designs: {
    path: '/designs',
    title: 'Henna Design Menu by Price | Ethnic Henna',
    description: 'Browse Ethnic Henna’s handpicked henna designs by price, then send your favorite design to Deepali on WhatsApp.',
    h1: 'Designs by price.',
    image: '/designs-hero-desktop.jpg',
    imageAlt: 'Paired henna hands reaching into warm candlelight beside flowers and carved wood',
    robots: 'index,follow',
  },
  bridal: {
    path: '/bridal',
    title: 'Bridal Henna Artist in the Bay Area | Ethnic Henna',
    description: 'Explore customized bridal henna by Ethnic Henna, serving San Ramon and the Bay Area with intricate designs shaped around your celebration.',
    h1: 'Bridal henna for your wedding.',
    image: '/bridal-hero-desktop.jpg',
    imageAlt: 'Bridal henna on hands styled with colorful chooda against a ceremony backdrop',
    robots: 'index,follow',
  },
  events: {
    path: '/events',
    title: 'Henna Artist for Parties & Events | Ethnic Henna',
    description: 'Book Ethnic Henna for weddings, birthdays, parties, and group events in San Ramon and across the Bay Area. Hourly event service by inquiry.',
    h1: 'Henna for your guests.',
    image: '/events-hero-desktop.jpg',
    imageAlt: 'Paired henna hands resting on red and gold silk for a celebration',
    robots: 'index,follow',
  },
  admin: {
    path: '/admin',
    title: 'Ethnic Henna Artist Dashboard',
    description: 'Private content management dashboard for Ethnic Henna.',
    image: '/brand/logo-mark.png',
    imageAlt: 'Ethnic Henna logo mark',
    robots: 'noindex,nofollow,noarchive',
  },
}

export function canonicalUrl(path) {
  return `${SITE_ORIGIN}${path === '/' ? '/' : path}`
}

export function getPageKey(pathname = '/', hash = '') {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path === '/admin' || hash === '#admin') return 'admin'
  if (path === '/designs' || hash === '#collections') return 'designs'
  if (path === '/bridal' || hash === '#bridal') return 'bridal'
  if (path === '/events') return 'events'
  if (path === '/work') return 'work'
  return 'home'
}

function businessEntity() {
  return {
    '@type': 'ProfessionalService',
    name: 'Ethnic Henna',
    telephone: '+1-510-340-8849',
    url: canonicalUrl('/'),
    logo: canonicalUrl('/brand/logo-mark.png'),
    image: canonicalUrl('/home-hero-desktop.jpg'),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'San Ramon',
      addressRegion: 'CA',
      addressCountry: 'US',
    },
    areaServed: serviceAreas,
  }
}

export function buildStructuredData(pageKey) {
  const page = seoPages[pageKey] || seoPages.home
  if (pageKey === 'admin') return []

  if (pageKey === 'home') {
    return [businessEntity()]
  }

  const breadcrumbs = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
    { '@type': 'ListItem', position: 2, name: pageKey === 'designs' ? 'Design by Pricing' : pageKey[0].toUpperCase() + pageKey.slice(1), item: canonicalUrl(page.path) },
  ]
  const data = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbs }]

  if (pageKey === 'bridal' || pageKey === 'events') {
    data.unshift({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: pageKey === 'bridal' ? 'Bridal Henna' : 'Event Henna',
      description: page.description,
      provider: businessEntity(),
      areaServed: serviceAreas,
      url: canonicalUrl(page.path),
    })
  }

  return data
}

function setMeta(documentRef, selector, attribute, value) {
  let element = documentRef.head.querySelector(selector)
  if (!element) {
    element = documentRef.createElement('meta')
    element.setAttribute(attribute, selector.match(/\[(?:name|property)="([^"]+)"\]/)?.[1] || '')
    documentRef.head.appendChild(element)
  }
  element.setAttribute('content', value)
}

export function applySeoMetadata(pageKey, documentRef = typeof document === 'undefined' ? null : document) {
  if (!documentRef?.head) return
  const page = seoPages[pageKey] || seoPages.home
  const url = canonicalUrl(page.path)
  documentRef.documentElement.lang = 'en'
  documentRef.title = page.title
  setMeta(documentRef, 'meta[name="description"]', 'name', page.description)
  setMeta(documentRef, 'meta[name="robots"]', 'name', page.robots)
  setMeta(documentRef, 'meta[property="og:type"]', 'property', 'website')
  setMeta(documentRef, 'meta[property="og:title"]', 'property', page.title)
  setMeta(documentRef, 'meta[property="og:description"]', 'property', page.description)
  setMeta(documentRef, 'meta[property="og:url"]', 'property', url)
  setMeta(documentRef, 'meta[property="og:image"]', 'property', canonicalUrl(page.image))
  setMeta(documentRef, 'meta[property="og:image:alt"]', 'property', page.imageAlt)
  setMeta(documentRef, 'meta[name="twitter:card"]', 'name', 'summary_large_image')
  setMeta(documentRef, 'meta[name="twitter:title"]', 'name', page.title)
  setMeta(documentRef, 'meta[name="twitter:description"]', 'name', page.description)
  setMeta(documentRef, 'meta[name="twitter:image"]', 'name', canonicalUrl(page.image))
  let link = documentRef.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = documentRef.createElement('link')
    link.setAttribute('rel', 'canonical')
    documentRef.head.appendChild(link)
  }
  link.setAttribute('href', url)
  documentRef.head.querySelector('#structured-data')?.remove()
  const structuredData = buildStructuredData(pageKey)
  if (structuredData.length) {
    const script = documentRef.createElement('script')
    script.id = 'structured-data'
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(structuredData.length === 1 ? structuredData[0] : structuredData)
    documentRef.head.appendChild(script)
  }
}
