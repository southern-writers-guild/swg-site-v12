/* ============================================================
   SWG Circular: issue page and piece page drawing.
   js/circular.js

   Loaded only by /circular/<issue>/ and /circular/<issue>/<piece>/ (its
   own chunk, so no other page pays for it). Reads an issue through the
   shared query in js/circular-query.js. Inside a Visual Editor session it
   reads the draft through /api/preview-doc, whose text arrives with
   invisible edit markers (stega): those stay in visible text, so clicking
   it opens the right box in Sanity, and are stripped with clean() before
   any value is used in logic, an address, an attribute or <title>.
   Every word a reader sees comes from Sanity; the wording below is only a
   fallback for a box left blank.
   ============================================================ */

import { stegaClean } from '@sanity/client/stega'
import { sanityFetch, renderPortableText, renderInline, plainTextOf, esc } from './sanity.js'
import { CIRCULAR_ISSUE_BY_ADDRESS } from './circular-query.js'

const clean = v => (typeof v === 'string' ? stegaClean(v) : v)
const pad = n => String(n).padStart(2, '0')

// Editor values: one-line boxes render inline, writing boxes as
// paragraphs; older documents may still hold plain strings.
const inline = v => renderInline(v)
const plain = v => clean(plainTextOf(v))
const has = v => Boolean(plain(v).trim())
function writing(v) {
  if (!v) return ''
  if (Array.isArray(v)) return renderPortableText(v)
  return paragraphs(v)
}

/* ── Fetching ───────────────────────────────────────────────── */

function isPreviewing() {
  return document.cookie.split('; ').some(c => c.indexOf('swg_preview_active=') === 0)
}

export function fetchIssue(address) {
  const published = () => sanityFetch(CIRCULAR_ISSUE_BY_ADDRESS, { issue: address })
  if (!isPreviewing()) return published()
  return fetch(`/api/preview-doc?type=circularIssue&slug=${encodeURIComponent(address)}`)
    .then(res => {
      if (!res.ok) throw new Error('Preview fetch failed')
      return res.json()
    })
    .then(data => data.result)
    .catch(published)
}

/* ── Addresses ──────────────────────────────────────────────── */

export function issuePath(issue) {
  return `/circular/${pad(clean(issue.issueNumber))}/`
}

// Plain words, for <title> and alt text.
export function issueLabel(issue) {
  return plain(issue.issueLabel) || `Issue No. ${pad(clean(issue.issueNumber))}`
}

// The publication's name in plain words, for <title>.
export function publicationName(issue) {
  return plain(issue.publicationTitle) || 'The SWG Circular'
}

function issueLabelHtml(issue) {
  return has(issue.issueLabel) ? inline(issue.issueLabel) : `Issue No. ${pad(clean(issue.issueNumber))}`
}

function slugify(text) {
  return String(text || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'piece'
}

// Every written Full piece in the issue, in page order, each with its web
// address. Addresses come from titles; a repeated title in the same issue
// gets -2, -3 (the Studio form promises this).
export function issuePieces(issue) {
  const used = {}
  const out = []
  ;(issue.blocks || []).forEach(block => {
    ;(block.entries || []).forEach(entry => {
      const p = entry.piece
      if (!p || !Array.isArray(p.body) || !p.body.length) return
      let slug = slugify(plain(p.title))
      used[slug] = (used[slug] || 0) + 1
      if (used[slug] > 1) slug = `${slug}-${used[slug]}`
      out.push({ slug, entry, piece: p, block })
    })
  })
  return out
}

const PAGE_PATHS = {
  porchStory: s => `/the-porch/${s}/`,
  writer: s => `/writers/${s}/`,
  guildVideo: s => `/the-work/videos/${s}/`,
  event: s => `/events/${s}/`,
  featuredFiction: s => `/the-work/featured/${s}/`
}

function linkTarget(link) {
  if (!link) return null
  const page = link.page
  if (page && page.slug && PAGE_PATHS[clean(page._type)]) {
    return { href: PAGE_PATHS[clean(page._type)](clean(page.slug)), external: false }
  }
  if (link.url) return { href: clean(link.url), external: true }
  return null
}

function entryTarget(entry, issue, pieces) {
  const found = pieces.find(p => p.entry === entry)
  if (found) return { href: `${issuePath(issue)}${found.slug}/`, external: false }
  return linkTarget(entry.link)
}

function anchor(target, inner, cls) {
  if (!target) return inner
  const ext = target.external ? ' target="_blank" rel="noopener"' : ''
  return `<a href="${esc(target.href)}"${ext}${cls ? ` class="${cls}"` : ''}>${inner}</a>`
}

function img(url, width) {
  const u = clean(url)
  return u ? `${esc(u)}?w=${width}&auto=format` : ''
}

// Plain text with blank lines between paragraphs -> <p> per paragraph.
function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean)
    .map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')
}

/* ── The issue's front page ─────────────────────────────────── */

export function renderMasthead(issue) {
  return `
    <header class="circ-masthead">
      ${has(issue.presenterLine) ? `<p class="circ-presents">${inline(issue.presenterLine)}</p>` : ''}
      <h1 class="circ-title">${has(issue.publicationTitle) ? inline(issue.publicationTitle) : 'The SWG Circular'}</h1>
      <div class="circ-rule"></div>
      <p class="circ-issue">${issueLabelHtml(issue)}${has(issue.seasonName) ? ` &nbsp;·&nbsp; ${inline(issue.seasonName)}` : ''}</p>
      ${has(issue.tagline) ? `<p class="circ-tagline">${inline(issue.tagline)}</p>` : ''}
    </header>`
}

function renderFeature(block) {
  const story = block.story
  if (!story) return ''
  const target = story.slug ? { href: `/the-porch/${clean(story.slug)}/`, external: false } : null
  const title = clean(story.title)
  // Teaser: the partner's own words, or the story's opening paragraphs,
  // skipping any line that only repeats the title or a "A Porch Story"
  // style subtitle line that some imported stories begin with.
  let teaser = ''
  if (has(block.teaser)) {
    teaser = writing(block.teaser)
  } else {
    const n = Number(clean(block.openingParagraphs)) || 3
    const opening = (story.opening || []).filter(t => {
      const c = clean(t).trim()
      return c && c !== title && !/^a porch story\b/i.test(c)
    }).slice(0, n)
    teaser = opening.map(t => `<p>${esc(t)}</p>`).join('')
  }
  const byline = has(block.byline) ? inline(block.byline) : (story.authors ? `By ${esc(story.authors)}` : '')
  const picture = block.imageUrl || story.imageUrl
  return `
    <section class="circ-block circ-feature">
      ${has(block.heading) ? `<p class="circ-eyebrow">${inline(block.heading)}</p>` : ''}
      <div class="circ-feature-grid${picture ? '' : ' circ-feature-grid--text'}">
        ${picture ? anchor(target, `<img src="${img(picture, 1100)}" alt="${esc(title)}">`, 'circ-feature-image') : ''}
        <div class="circ-feature-text">
          <h2 class="circ-feature-title">${anchor(target, esc(story.title))}</h2>
          ${byline ? `<p class="circ-byline">${byline}</p>` : ''}
          <div class="circ-teaser">${teaser}</div>
          ${target ? `<p>${anchor(target, `${has(block.buttonLabel) ? inline(block.buttonLabel) : 'Read the full story'} &#8594;`, 'circ-button')}</p>` : ''}
        </div>
      </div>
    </section>`
}

function renderTeasers(block, issue, pieces) {
  const look = clean(block.look) === 'images' ? 'images' : 'portraits'
  const entries = (block.entries || []).map(entry => {
    const target = entryTarget(entry, issue, pieces)
    const picUrl = look === 'portraits' ? (entry.portraitUrl || entry.imageUrl) : (entry.imageUrl || entry.portraitUrl)
    const pic = picUrl
      ? anchor(target, `<img src="${img(picUrl, look === 'portraits' ? 240 : 800)}" alt="${esc(plain(entry.title))}">`, `circ-entry-pic circ-entry-pic--${look}`)
      : ''
    return `
      <article class="circ-entry circ-entry--${look}">
        ${pic}
        <div class="circ-entry-text">
          <h3 class="circ-entry-title">${anchor(target, inline(entry.title))}</h3>
          ${has(entry.subtitle) ? `<p class="circ-entry-sub">${inline(entry.subtitle)}</p>` : ''}
          ${has(entry.text) ? `<div class="circ-entry-body">${writing(entry.text)}</div>` : ''}
          ${target ? `<p class="circ-entry-more">${anchor(target, `${has(entry.buttonLabel) ? inline(entry.buttonLabel) : 'Read more'} &#8594;`)}</p>` : ''}
        </div>
      </article>`
  }).join('')
  return `
    <section class="circ-block circ-teasers circ-teasers--${look}">
      ${has(block.heading) ? `<h2 class="circ-heading">${inline(block.heading)}</h2>` : ''}
      ${has(block.subheading) ? `<p class="circ-subheading">${inline(block.subheading)}</p>` : ''}
      <div class="circ-entries">${entries}</div>
    </section>`
}

function renderLinkList(block) {
  const items = (block.items || []).map(item => {
    const target = linkTarget(item.link)
    const page = (item.link && item.link.page) || {}
    const label = has(item.label) ? inline(item.label) : esc([page.title || page.characterName, page.authors].filter(Boolean).join(' from '))
    if (!label) return ''
    const picUrl = item.imageUrl || page.imageUrl
    const pic = picUrl ? `<img src="${img(picUrl, 200)}" alt="">` : '<span class="circ-link-blank"></span>'
    return `<li>${anchor(target, `${pic}<span class="circ-link-label">${label}</span><span class="circ-link-arrow">&#8594;</span>`, 'circ-link')}</li>`
  }).join('')
  return `
    <section class="circ-block circ-linklist">
      ${has(block.heading) ? `<h2 class="circ-heading">${inline(block.heading)}</h2>` : ''}
      ${has(block.subheading) ? `<p class="circ-subheading">${inline(block.subheading)}</p>` : ''}
      <ul class="circ-links">${items}</ul>
    </section>`
}

function renderNote(block) {
  return `
    <section class="circ-block circ-note">
      ${has(block.heading) ? `<h2 class="circ-heading">${inline(block.heading)}</h2>` : ''}
      <div class="prose">${renderPortableText(block.body || [])}</div>
    </section>`
}

function renderSignOff(block) {
  const people = clean(block.showWriters) === false ? [] : (block.people || [])
  const row = people.map(p => {
    const target = p.slug ? { href: `/writers/${clean(p.slug)}/`, external: false } : null
    const photo = p.photoUrl ? `<img src="${img(p.photoUrl, 200)}" alt="${esc(plain(p.name))}">` : '<span class="circ-person-blank"></span>'
    return anchor(target, `${photo}<span>${inline(p.name)}</span>`, 'circ-person')
  }).join('')
  return `
    <section class="circ-block circ-signoff">
      ${has(block.closingLine) ? `<div class="circ-closing">${writing(block.closingLine)}</div>` : ''}
      ${row ? `${has(block.writersLabel) ? `<p class="circ-eyebrow">${inline(block.writersLabel)}</p>` : ''}<div class="circ-people">${row}</div>` : ''}
      <p><a href="/" class="circ-button">${has(block.siteLinkLabel) ? inline(block.siteLinkLabel) : 'Visit the Southern Writers Guild'} &#8594;</a></p>
    </section>`
}

export function renderIssue(issue) {
  const pieces = issuePieces(issue)
  const blocks = (issue.blocks || []).map(block => {
    switch (clean(block._type)) {
      case 'circularFeature': return renderFeature(block)
      case 'circularTeasers': return renderTeasers(block, issue, pieces)
      case 'circularLinkList': return renderLinkList(block)
      case 'circularNote': return renderNote(block)
      case 'circularSignOff': return renderSignOff(block)
      default: return ''
    }
  }).join('')
  return renderMasthead(issue) + blocks
}

/* ── A piece's own page ─────────────────────────────────────── */

export function renderPiece(issue, slug) {
  const pieces = issuePieces(issue)
  const i = pieces.findIndex(p => p.slug === slug)
  if (i < 0) return null
  const { piece, entry } = pieces[i]
  const layout = clean(piece.layout)
  const layoutClass = layout === 'book' || layout === 'gaps' ? ` story-layout layout-${layout}` : ''
  const portrait = entry.portraitUrl ? `<img class="circ-piece-portrait" src="${img(entry.portraitUrl, 120)}" alt="">` : ''
  const lead = piece.leadImage && piece.leadImage.asset
    ? `<div class="circ-piece-lead">${renderPortableText([{ ...piece.leadImage, _type: 'image', size: 'full' }])}</div>`
    : ''
  const button = piece.outsideButton && piece.outsideButton.url
    ? `<p style="margin-top:var(--sp-md);"><a href="${esc(clean(piece.outsideButton.url))}" target="_blank" rel="noopener" class="circ-button">${has(piece.outsideButton.label) ? inline(piece.outsideButton.label) : 'Visit'} &#8594;</a></p>`
    : ''
  const others = pieces.filter((_, j) => j !== i).map(p =>
    `<li><a href="${issuePath(issue)}${p.slug}/">${inline(p.piece.title)}</a>${has(p.piece.byline) ? ` <span>${inline(p.piece.byline)}</span>` : ''}</li>`
  ).join('')
  return {
    title: plain(piece.title),
    html: `
      <p class="circ-piece-issue"><a href="${issuePath(issue)}">${esc(plain(issue.publicationTitle) || 'The SWG Circular')} &nbsp;·&nbsp; ${esc(issueLabel(issue))}${has(issue.seasonName) ? ` &nbsp;·&nbsp; ${esc(plain(issue.seasonName))}` : ''}</a></p>
      ${has(piece.columnLabel) ? `<p class="circ-eyebrow">${inline(piece.columnLabel)}</p>` : ''}
      <h1 class="circ-piece-title">${inline(piece.title)}</h1>
      ${has(piece.byline) ? `<p class="circ-piece-byline">${portrait}<span>${inline(piece.byline)}</span></p>` : ''}
      ${lead}
      <div class="prose${layoutClass}">${renderPortableText(piece.body)}</div>
      ${button}
      <nav class="circ-piece-nav">
        <a href="${issuePath(issue)}" class="circ-button">&#8592; Back to ${issueLabelHtml(issue)}</a>
        ${others ? `<p class="circ-eyebrow" style="margin-top:var(--sp-md);">Also in this issue</p><ul class="circ-also">${others}</ul>` : ''}
      </nav>`
  }
}
