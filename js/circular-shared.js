/* ============================================================
   SWG Circular: helpers shared by the web pages (js/circular.js) and
   the email builder (js/circular-email.js), so a piece's address and a
   link's destination are always worked out the same way in both.
   No imports: usable in the browser bundle and in serverless functions.
   ============================================================ */

export const pad = n => String(n).padStart(2, '0')

export function slugify(text) {
  return String(text || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'piece'
}

// Every written Full piece in the issue, in page order, with its address.
// Addresses come from titles; a repeated title in the same issue gets -2,
// -3. plainOf turns a title (editor value or string) into plain words.
export function issuePieces(issue, plainOf) {
  const used = {}
  const out = []
  ;(issue.blocks || []).forEach(block => {
    ;(block.entries || []).forEach(entry => {
      const p = entry.piece
      if (!p || !Array.isArray(p.body) || !p.body.length) return
      let slug = slugify(plainOf(p.title))
      used[slug] = (used[slug] || 0) + 1
      if (used[slug] > 1) slug = `${slug}-${used[slug]}`
      out.push({ slug, entry, piece: p, block })
    })
  })
  return out
}

export const PAGE_PATHS = {
  porchStory: s => `/the-porch/${s}/`,
  writer: s => `/writers/${s}/`,
  guildVideo: s => `/the-work/videos/${s}/`,
  event: s => `/events/${s}/`,
  featuredFiction: s => `/the-work/featured/${s}/`
}

export function issuePathFor(number) {
  return `/circular/${pad(number)}/`
}
