import { createClient } from '@sanity/client';
import { CIRCULAR_ISSUE_PROJECTION } from '../js/circular-query.js';
import { buildCircularEmail } from '../js/circular-email.js';

// SWG Circular -> Kit hand-off (stage 5, 2026-11-02).
//
// POST (called by a Sanity webhook when a circularIssue is published):
//   1. Ignores everything in the request except the document _id.
//   2. Re-reads the PUBLISHED issue from Sanity itself. Acts only if its
//      "Send to Kit" switch is on.
//   3. Builds the light-paper email (js/circular-email.js).
//   4. Looks in Kit for a draft it made earlier for this issue (tagged in
//      the broadcast's internal description). If none: creates an unsent
//      draft. If one exists and has not started sending: replaces its
//      subject, preview line and content, keeping Grace's recipients,
//      schedule and template exactly as she set them in Kit. If it has
//      already gone out: does nothing.
//   Nothing is ever sent from here. Because the function trusts only
//   Sanity's own published data and only ever writes unsent drafts, a
//   forged call can at most refresh a draft with the real issue: no
//   shared secret is needed. (If SANITY_WEBHOOK_SECRET is ever set, it is
//   additionally required as ?key= on the webhook URL.)
//
// GET ?check: reports whether KIT_API_KEY is set and accepted by Kit
// (status only; the key is never shown). This replaces the deferred
// stage 1 key check.

const KIT = 'https://api.kit.com/v4';
const client = createClient({
  projectId: 'fe6l0kiy',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  perspective: 'published',
});

const marker = id => `[swg-circular:${id}]`;

async function kit(path, options = {}) {
  const res = await fetch(KIT + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': process.env.KIT_API_KEY, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function findDraft(id) {
  let after = null;
  for (let page = 0; page < 20; page++) {
    const q = `/broadcasts?per_page=500${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const r = await kit(q);
    if (!r.ok) throw new Error(`Kit list broadcasts failed (${r.status}): ${JSON.stringify(r.body).slice(0, 300)}`);
    const hit = (r.body.broadcasts || []).find(b => (b.description || '').includes(marker(id)));
    if (hit) return hit;
    const p = r.body.pagination || {};
    if (!p.has_next_page) return null;
    after = p.end_cursor;
  }
  return null;
}

function alreadyGoing(b) {
  const status = String(b.status || '').toLowerCase();
  if (['completed', 'sending', 'sent'].includes(status)) return true;
  return Boolean(b.send_at && new Date(b.send_at) <= new Date());
}

async function readRaw(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (!('check' in (req.query || {}))) return res.status(404).send('Not found');
    if (!process.env.KIT_API_KEY) return res.status(200).json({ kitKey: 'missing' });
    const r = await kit('/account');
    return res.status(200).json({ kitKey: r.ok ? 'works' : `rejected (${r.status})` });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (process.env.SANITY_WEBHOOK_SECRET && (req.query || {}).key !== process.env.SANITY_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Not allowed' });
  }
  if (!process.env.KIT_API_KEY) return res.status(500).json({ error: 'KIT_API_KEY is not configured' });

  let id;
  try {
    const payload = JSON.parse(await readRaw(req) || '{}');
    id = String(payload._id || '').replace(/^drafts\./, '');
  } catch {
    return res.status(400).json({ error: 'Bad request' });
  }
  if (!/^[\w.-]+$/.test(id)) return res.status(400).json({ error: 'Missing document id' });

  try {
    const issue = await client.fetch(
      `*[_type == "circularIssue" && _id == $id][0]${CIRCULAR_ISSUE_PROJECTION}`,
      { id }
    );
    if (!issue) return res.status(200).json({ result: 'skipped', reason: 'no published issue with that id' });
    if (!issue.sendToKit) return res.status(200).json({ result: 'skipped', reason: 'Send to Kit is off' });
    if (issue.legacy) return res.status(200).json({ result: 'skipped', reason: 'older one-page issue' });

    const email = buildCircularEmail(issue);
    const existing = await findDraft(id);

    if (existing && alreadyGoing(existing)) {
      return res.status(200).json({ result: 'skipped', reason: 'already sent or sending from Kit', broadcast: existing.id });
    }

    if (existing) {
      const full = await kit(`/broadcasts/${existing.id}`);
      const b = (full.ok && full.body && full.body.broadcast) || existing;
      const body = {
        email_template_id: b.email_template ? b.email_template.id : undefined,
        email_address: b.email_address ?? null,
        content: email.html,
        description: b.description || `SWG Circular, made by the website ${marker(id)}`,
        public: Boolean(b.public),
        published_at: b.published_at || new Date().toISOString(),
        send_at: b.send_at ?? null,
        thumbnail_alt: b.thumbnail_alt ?? null,
        thumbnail_url: b.thumbnail_url ?? null,
        preview_text: email.previewText,
        subject: email.subject,
        subscriber_filter: b.subscriber_filter,
      };
      const r = await kit(`/broadcasts/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      if (!r.ok) {
        console.error('Kit update failed', r.status, JSON.stringify(r.body).slice(0, 500));
        return res.status(502).json({ result: 'failed', step: 'update', status: r.status, kit: r.body });
      }
      return res.status(200).json({ result: 'updated', broadcast: existing.id });
    }

    const createBody = {
      content: email.html,
      description: `SWG Circular, made by the website. Edit the words in Sanity; choose recipients and send here. ${marker(id)}`,
      public: false,
      published_at: new Date().toISOString(),
      send_at: null,
      preview_text: email.previewText,
      subject: email.subject,
    };
    let r = await kit('/broadcasts', { method: 'POST', body: JSON.stringify(createBody) });
    if (!r.ok && r.status === 422) {
      // Kit's spec lists subscriber_filter as required but says an empty one
      // means "all subscribers"; retry once with the documented shape.
      r = await kit('/broadcasts', { method: 'POST', body: JSON.stringify({ ...createBody, subscriber_filter: [{ all: null, any: null, none: null }] }) });
    }
    if (!r.ok) {
      console.error('Kit create failed', r.status, JSON.stringify(r.body).slice(0, 500));
      return res.status(502).json({ result: 'failed', step: 'create', status: r.status, kit: r.body });
    }
    const created = (r.body && r.body.broadcast) || {};
    return res.status(200).json({ result: 'created', broadcast: created.id });
  } catch (err) {
    console.error('circular-to-kit error', err);
    return res.status(500).json({ result: 'failed', error: String(err.message || err).slice(0, 300) });
  }
}
