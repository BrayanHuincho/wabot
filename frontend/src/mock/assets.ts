function blobUrl(parts: BlobPart[], type: string) {
  return URL.createObjectURL(new Blob(parts, { type }))
}

export function pdfUrl() {
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 60>>stream
BT /F1 28 Tf 72 760 Td (Wabot Demo - Servicios 2026) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`
  return blobUrl([pdf], 'application/pdf')
}

export function photoUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc3f0"/><stop offset="1" stop-color="#ffe2b8"/></linearGradient></defs>
<rect width="640" height="480" fill="url(#s)"/><circle cx="480" cy="140" r="54" fill="#fff4c2"/>
<path d="M0 360 L140 220 L250 320 L360 200 L520 350 L640 260 V480 H0Z" fill="#3f7d5a"/>
<path d="M0 420 L180 330 L320 410 L470 320 L640 400 V480 H0Z" fill="#2c5a40"/></svg>`
  return blobUrl([svg], 'image/svg+xml')
}

export function voiceUrl(seconds = 4) {
  const rate = 8000
  const samples = rate * seconds
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  write(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const t = i / rate
    const envelope = Math.abs(Math.sin(t * 3.1)) * 0.25
    view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 220 * t) * envelope * 32767, true)
  }
  return blobUrl([buffer], 'audio/wav')
}
