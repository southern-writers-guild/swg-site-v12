/* ============================================================
   SWG Circular: the email version of an issue (light paper).
   js/circular-email.js

   Builds the HTML Kit sends, from exactly the same issue data the web
   page uses (js/circular-query.js). Used by the Kit hand-off
   (api/circular-to-kit.js) and by the preview page /circular-email/<n>/.
   Written for email programs, not browsers: tables, inline styles, web-
   safe fonts (Georgia), fixed 600px width that narrows on phones. Every
   link points at the website, where the full pieces live. Kit adds its
   own required footer (unsubscribe, address). No imports beyond the
   shared helpers, so it runs in the browser and in a serverless function.
   ============================================================ */

import { pad, issuePieces, PAGE_PATHS, issuePathFor } from './circular-shared.js'

export const SITE = 'https://www.southernwritersguild.com'

const C = {
  paper: '#f3ead8',
  card: '#fbf6ec',
  edge: '#e3d5bb',
  rule: '#d8c7a8',
  ink: '#3b2f25',
  muted: '#6e5f50',
  accent: '#a5482c',
  serif: "Georgia, 'Times New Roman', Times, serif",
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif"
}

/* ── Text helpers (editor values or plain strings) ─────────── */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function plain(v) {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (!Array.isArray(v)) return ''
  return v.filter(b => b && b._type === 'block').map(b => (b.children || []).map(c => c.text || '').join('')).join(' ')
}

const has = v => Boolean(plain(v).trim())

function abs(href) {
  if (!href) return SITE + '/'
  return /^https?:|^mailto:/.test(href) ? href : SITE + href
}

function spans(block, linkColor) {
  const defs = block.markDefs || []
  return (block.children || []).map(span => {
    let t = esc(span.text || '').replace(/\n/g, '<br>')
    ;(span.marks || []).forEach(mark => {
      const def = defs.find(d => d._key === mark)
      if (def && def._type === 'link' && def.href) t = `<a href="${esc(abs(def.href))}" style="color:${linkColor};text-decoration:underline;">${t}</a>`
      else if (mark === 'strong') t = `<strong>${t}</strong>`
      else if (mark === 'em') t = `<em>${t}</em>`
      else if (mark === 'underline') t = `<u>${t}</u>`
      else if (mark === 'strike-through') t = `<s>${t}</s>`
      else if (mark === 'code') t = `<code>${t}</code>`
    })
    return t
  }).join('')
}

// One-line boxes: inline HTML.
function inline(v, linkColor = C.accent) {
  if (!v) return ''
  if (typeof v === 'string') return esc(v)
  return v.filter(b => b && b._type === 'block').map(b => spans(b, linkColor)).join('<br>')
}

function imageFromRef(ref, width) {
  if (!ref) return ''
  const parts = ref.replace('image-', '').split('-')
  const ext = parts.pop()
  return `https://cdn.sanity.io/images/fe6l0kiy/production/${parts.join('-')}.${ext}?w=${width}&fit=max&auto=format`
}

// Sanity image addresses end in -<width>x<height>.<ext>; a tall picture
// (a book cover) is shown narrower and centred so it doesn't fill a phone.
function isTall(url) {
  const m = String(url || '').match(/-(\d+)x(\d+)\.\w+(?:\?|$)/)
  return m ? Number(m[2]) > Number(m[1]) * 1.1 : false
}

function bigImage(url, alt, href) {
  const tall = isTall(url)
  const w = tall ? 240 : 528
  const img = `<img src="${esc(imgUrl(url, w * 2))}" width="${w}" alt="${esc(alt || '')}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;margin:0 auto 14px;">`
  return href ? `<a href="${esc(abs(href))}">${img}</a>` : img
}

function imgUrl(url, width) {
  return url ? `${url}?w=${width}&fit=max&auto=format` : ''
}

// Writing boxes: paragraphs, with the styles the site's editor offers.
function writing(v, opts = {}) {
  const color = opts.color || C.ink
  const size = opts.size || 17
  const align = opts.align || 'left'
  const italic = opts.italic ? 'font-style:italic;' : ''
  const p = inner => `<p style="margin:0 0 14px;font-family:${C.serif};font-size:${size}px;line-height:1.6;color:${color};text-align:${align};${italic}">${inner}</p>`
  if (!v) return ''
  if (typeof v === 'string') {
    return v.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).map(t => p(esc(t).replace(/\n/g, '<br>'))).join('')
  }
  const out = []
  let list = null
  const flush = () => { if (list) { out.push(`<${list.tag} style="margin:0 0 14px 22px;padding:0;font-family:${C.serif};font-size:${size}px;line-height:1.6;color:${color};">${list.items.join('')}</${list.tag}>`); list = null } }
  v.forEach(b => {
    if (b._type === 'block') {
      if (b.listItem) {
        const tag = b.listItem === 'number' ? 'ol' : 'ul'
        if (!list || list.tag !== tag) { flush(); list = { tag, items: [] } }
        list.items.push(`<li style="margin:0 0 6px;">${spans(b, C.accent)}</li>`)
        return
      }
      flush()
      const inner = spans(b, C.accent)
      if (!inner.trim()) return
      if (b.style === 'h2') out.push(`<h2 style="margin:22px 0 10px;font-family:${C.serif};font-size:24px;font-weight:normal;color:${C.ink};">${inner}</h2>`)
      else if (b.style === 'h3') out.push(`<h3 style="margin:20px 0 8px;font-family:${C.serif};font-size:20px;font-weight:normal;color:${C.ink};">${inner}</h3>`)
      else if (b.style === 'h4') out.push(`<h4 style="margin:18px 0 6px;font-family:${C.sans};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};">${inner}</h4>`)
      else if (b.style === 'blockquote') out.push(`<p style="margin:0 0 14px;padding-left:14px;border-left:3px solid ${C.rule};font-family:${C.serif};font-size:${size}px;line-height:1.6;font-style:italic;color:${color};">${inner}</p>`)
      else out.push(p(inner))
      return
    }
    flush()
    if (b._type === 'image' && b.asset) {
      out.push(`<p style="margin:0 0 14px;text-align:center;"><img src="${esc(imageFromRef(b.asset._ref, 1080))}" width="540" alt="${esc(b.caption || '')}" style="display:block;width:100%;max-width:540px;height:auto;border:0;margin:0 auto;"></p>`)
    } else if (b._type === 'divider') {
      out.push(`<hr style="border:0;border-top:1px solid ${C.rule};margin:20px 0;">`)
    } else if (b._type === 'poetryBlock' && b.text) {
      out.push(`<p style="margin:0 0 14px;font-family:${C.serif};font-size:${size}px;line-height:1.6;color:${color};white-space:pre-wrap;">${esc(b.text)}</p>`)
    }
  })
  flush()
  return out.join('')
}

/* ── Pieces of the layout ───────────────────────────────────── */

const row = (inner, pad = '28px 36px') => `<tr><td style="padding:${pad};">${inner}</td></tr>`
const ruleRow = () => `<tr><td style="padding:0 36px;"><div style="border-top:1px solid ${C.rule};font-size:0;line-height:0;">&nbsp;</div></td></tr>`

function eyebrow(html, align = 'center') {
  return `<p style="margin:0 0 10px;font-family:${C.sans};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.accent};text-align:${align};">${html}</p>`
}

function heading(html) {
  return `<h2 style="margin:0 0 6px;font-family:${C.serif};font-size:28px;font-weight:normal;color:${C.ink};text-align:center;">${html}</h2>`
}

// "Line under the heading": reads exactly like the masthead tagline
// (Rick, 2026-11-02): Georgia 19px italic, muted.
function subheading(v, gap) {
  return `<p style="margin:0 0 ${gap}px;font-family:${C.serif};font-size:19px;font-style:italic;color:${C.muted};text-align:center;">${inline(v)}</p>`
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 0;"><tr><td bgcolor="${C.accent}" style="background:${C.accent};border-radius:2px;">
    <a href="${esc(abs(href))}" style="display:inline-block;padding:11px 22px;font-family:${C.sans};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${label}</a>
  </td></tr></table>`
}

function textLink(href, label) {
  return `<a href="${esc(abs(href))}" style="font-family:${C.sans};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.accent};text-decoration:none;">${label} &rarr;</a>`
}

function linkTarget(link) {
  if (!link) return null
  const page = link.page
  if (page && page.slug && PAGE_PATHS[page._type]) return PAGE_PATHS[page._type](page.slug)
  return link.url || null
}

function masthead(issue) {
  const label = has(issue.issueLabel) ? inline(issue.issueLabel) : `Issue No. ${pad(issue.issueNumber)}`
  return row(`
    ${has(issue.presenterLine) ? `<p style="margin:0 0 8px;font-family:${C.sans};font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${C.muted};text-align:center;">${inline(issue.presenterLine)}</p>` : ''}
    <h1 style="margin:0;font-family:${C.serif};font-size:44px;line-height:1.1;font-weight:normal;color:${C.ink};text-align:center;">${has(issue.publicationTitle) ? inline(issue.publicationTitle) : 'The SWG Circular'}</h1>
    <div style="width:110px;border-top:1px solid ${C.accent};margin:16px auto;font-size:0;line-height:0;">&nbsp;</div>
    <p style="margin:0;font-family:${C.sans};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${C.ink};text-align:center;">${label}${has(issue.seasonName) ? ` &nbsp;&middot;&nbsp; ${inline(issue.seasonName)}` : ''}</p>
    ${has(issue.tagline) ? `<p style="margin:10px 0 0;font-family:${C.serif};font-size:19px;font-style:italic;color:${C.muted};text-align:center;">${inline(issue.tagline)}</p>` : ''}
  `, '36px 36px 28px')
}

function feature(block) {
  const story = block.story
  if (!story) return ''
  const href = story.slug ? `/the-porch/${story.slug}/` : '/'
  const pic = block.imageUrl || story.imageUrl
  let teaser = ''
  if (has(block.teaser)) teaser = writing(block.teaser)
  else {
    const n = Number(block.openingParagraphs) || 3
    teaser = (story.opening || []).filter(t => t && t.trim() !== story.title && !/^a porch story\b/i.test(t)).slice(0, n)
      .map(t => writing(t)).join('')
  }
  const byline = has(block.byline) ? inline(block.byline) : (story.authors ? `By ${esc(story.authors)}` : '')
  return row(`
    ${has(block.heading) ? eyebrow(inline(block.heading)) : ''}
    ${pic ? bigImage(pic, story.title, href) : ''}
    <h2 style="margin:0 0 6px;font-family:${C.serif};font-size:30px;line-height:1.15;font-weight:normal;"><a href="${esc(abs(href))}" style="color:${C.ink};text-decoration:none;">${esc(story.title)}</a></h2>
    ${byline ? `<p style="margin:0 0 14px;font-family:${C.sans};font-size:13px;color:${C.muted};">${byline}</p>` : ''}
    ${teaser}
    ${button(href, `${has(block.buttonLabel) ? inline(block.buttonLabel, '#ffffff') : 'Read the full story'} &rarr;`)}
  `)
}

function teasers(block, issue, pieces) {
  const look = block.look === 'images' ? 'images' : 'portraits'
  const entries = (block.entries || []).map(entry => {
    const found = pieces.find(p => p.entry === entry)
    const href = found ? `${issuePathFor(issue.issueNumber)}${found.slug}/` : linkTarget(entry.link)
    const label = `${has(entry.buttonLabel) ? inline(entry.buttonLabel) : 'Read more'}`
    const title = `<p style="margin:0;font-family:${C.serif};font-size:21px;line-height:1.25;color:${C.ink};">${href ? `<a href="${esc(abs(href))}" style="color:${C.ink};text-decoration:none;">${inline(entry.title, C.ink)}</a>` : inline(entry.title, C.ink)}</p>`
    const sub = has(entry.subtitle) ? `<p style="margin:2px 0 0;font-family:${C.serif};font-size:16px;font-style:italic;color:${C.muted};">${inline(entry.subtitle)}</p>` : ''
    const body = has(entry.text) ? `<div style="margin-top:6px;">${writing(entry.text, { color: C.muted, size: 16 })}</div>` : ''
    const more = href ? `<p style="margin:2px 0 0;">${textLink(href, label)}</p>` : ''
    if (look === 'portraits') {
      const pic = entry.portraitUrl || entry.imageUrl
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
        ${pic ? `<td width="84" valign="top" style="padding-right:16px;"><img src="${esc(imgUrl(pic, 168))}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;border-radius:36px;border:0;object-fit:cover;"></td>` : ''}
        <td valign="top">${title}${sub}${body}${more}</td>
      </tr></table>`
    }
    const pic = entry.imageUrl || entry.portraitUrl
    return `<div style="margin:0 0 26px;">
      ${pic ? bigImage(pic, plain(entry.title), href || '/') : ''}
      ${title}${sub}${body}${more}
    </div>`
  }).join('')
  return row(`
    ${has(block.heading) ? heading(inline(block.heading)) : ''}
    ${has(block.subheading) ? subheading(block.subheading, 18) : '<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>'}
    ${entries}
  `)
}

function linkList(block) {
  const items = (block.items || []).map(item => {
    const href = linkTarget(item.link)
    const page = (item.link && item.link.page) || {}
    const label = has(item.label) ? inline(item.label, C.ink) : esc([page.title || page.characterName, page.authors].filter(Boolean).join(' from '))
    if (!label) return ''
    const pic = item.imageUrl || page.imageUrl
    return `<tr>
      ${pic ? `<td width="88" valign="middle" style="padding:10px 14px 10px 0;border-top:1px solid ${C.rule};"><img src="${esc(imgUrl(pic, 160))}" width="72" alt="" style="display:block;width:72px;height:auto;border:0;"></td>` : ''}
      <td valign="middle" style="padding:10px 0;border-top:1px solid ${C.rule};font-family:${C.serif};font-size:18px;"><a href="${esc(abs(href || '/'))}" style="color:${C.ink};text-decoration:none;">${label} <span style="color:${C.accent};">&rarr;</span></a></td>
    </tr>`
  }).join('')
  return row(`
    ${has(block.heading) ? heading(inline(block.heading)) : ''}
    ${has(block.subheading) ? subheading(block.subheading, 14) : '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>'}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
  `)
}

function note(block) {
  return row(`
    ${has(block.heading) ? heading(inline(block.heading)) : ''}
    <div style="margin-top:12px;">${writing(block.body || [])}</div>
  `)
}

function signOff(block) {
  const people = block.showWriters === false ? [] : (block.people || [])
  const cells = people.map(p => {
    const href = p.slug ? `/writers/${p.slug}/` : '/'
    return `<td align="center" valign="top" style="padding:0 10px;">
      <a href="${esc(abs(href))}" style="text-decoration:none;color:${C.ink};">
        ${p.photoUrl ? `<img src="${esc(imgUrl(p.photoUrl, 128))}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:28px;border:0;margin:0 auto 6px;object-fit:cover;">` : ''}
        <span style="font-family:${C.serif};font-size:16px;color:${C.ink};">${inline(p.name, C.ink)}</span>
      </a>
    </td>`
  }).join('')
  return row(`
    ${has(block.closingLine) ? writing(block.closingLine, { size: 24, italic: true, align: 'center' }) : ''}
    ${cells ? `${has(block.writersLabel) ? eyebrow(inline(block.writersLabel)) : ''}<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px;"><tr>${cells}</tr></table>` : ''}
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td>${button('/', `${has(block.siteLinkLabel) ? inline(block.siteLinkLabel, '#ffffff') : 'Visit the Southern Writers Guild'} &rarr;`)}</td></tr></table>
  `, '32px 36px 40px')
}

/* ── The whole email ────────────────────────────────────────── */

export function emailSubject(issue) {
  if (issue.emailSubject && issue.emailSubject.trim()) return issue.emailSubject.trim()
  const label = plain(issue.issueLabel) || `Issue No. ${pad(issue.issueNumber)}`
  return [plain(issue.publicationTitle) || 'The SWG Circular', label, plain(issue.seasonName)].filter(Boolean).join(' · ')
}

export function emailPreviewText(issue) {
  if (issue.emailPreview && issue.emailPreview.trim()) return issue.emailPreview.trim()
  return plain(issue.tagline)
}

export function buildCircularEmail(issue) {
  const pieces = issuePieces(issue, plain)
  const parts = []
  ;(issue.blocks || []).forEach((block, i) => {
    let html = ''
    switch (block._type) {
      case 'circularFeature': html = feature(block); break
      case 'circularTeasers': html = teasers(block, issue, pieces); break
      case 'circularLinkList': html = linkList(block); break
      case 'circularNote': html = note(block); break
      case 'circularSignOff': html = signOff(block); break
    }
    if (html) parts.push(ruleRow(), html)
  })
  const preview = emailPreviewText(issue)
  const web = abs(issuePathFor(issue.issueNumber))
  const html = `<!-- SWG Circular email, built by the website from Sanity. Edit in Sanity, not here. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.paper}" style="background:${C.paper};">
  <tr><td align="center" style="padding:20px 10px 28px;">
    <p style="margin:0 0 12px;font-family:${C.sans};font-size:11px;color:${C.muted};text-align:center;"><a href="${esc(web)}" style="color:${C.muted};">Read this issue on the website</a></p>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.edge};">
      ${masthead(issue)}
      ${parts.join('\n')}
    </table>
  </td></tr>
</table>`
  return { subject: emailSubject(issue), previewText: preview, html }
}
