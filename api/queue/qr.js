import QRCode from 'qrcode'
import { requireArtist } from '../_lib/auth.js'
import { siteUrl, wrap } from '../_lib/http.js'

export default wrap(async (req, res) => {
  const session = requireArtist(req, res)
  if (!session) return
  const target = `${siteUrl(req)}/queue`
  const svg = await QRCode.toString(target, { type: 'svg', margin: 1, width: 512, errorCorrectionLevel: 'M' })
  res.statusCode = 200
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(svg)
})
