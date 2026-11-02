import { createClient } from '@sanity/client';
import { isValidPreviewRequest } from './_lib/preview.js';

// One preview endpoint for every document that has its own page, found by
// slug. Replaces four near-identical single-type files (preview-story.js,
// preview-event.js, preview-video.js, preview-writer.js), the same move
// preview-singleton.js made for the one-off pages in September. Reason:
// Vercel's Hobby plan allows 12 serverless functions per deployment, and
// the site had used all 12. A new slug-based type is one more entry in
// QUERIES below, not a new file.
//
// Called as /api/preview-doc?type=<type>&slug=<slug>. Only runs inside an
// active preview session (isValidPreviewRequest checks the HttpOnly
// preview cookie), so draft content and stega-encoded edit markers never
// reach an ordinary visitor.
const PROJECT_ID = 'fe6l0kiy';
const DATASET = 'production';
const API_VERSION = '2024-01-01';

// Single default-workspace Studio (sanity.config.js: name: 'default', no
// basePath), so this plain origin is a complete studioUrl on its own.
const STUDIO_URL = 'https://swg-studio.sanity.studio';

const WRITER_FIELDS = `_id, characterName, characterDescriptor, realName,
        writerBio, characterBio, displayOrder, "slug": slug.current,
        "characterPhotoUrl": characterPhoto.asset->url,
        "characterPhotoHotspot": characterPhoto.hotspot,
        "avatarPhotoUrl": avatarPhoto.asset->url,
        links`;

// type -> GROQ query (each takes $slug). Matches exactly what each old
// single-type endpoint fetched, so every page gets the same shape back.
const QUERIES = {
  porchStory: `*[_type == "porchStory" && slug.current == $slug][0]`,
  event: `*[_type == "event" && slug.current == $slug][0]`,
  guildVideo: `*[_type == "guildVideo" && slug.current == $slug][0]`,
  writer: `*[_type == "writer" && slug.current == $slug][0] {${WRITER_FIELDS}}`,
};

export default async function handler(req, res) {
  if (req.method !== 'GET' || !isValidPreviewRequest(req)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('Not found');
  }

  const type = req.query && req.query.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(QUERIES, type)) {
    return res.status(400).json({ error: 'Missing or invalid type' });
  }

  const slug = req.query && req.query.slug;
  if (typeof slug !== 'string' || !slug) {
    return res.status(400).json({ error: 'Missing slug' });
  }

  const token = process.env.SANITY_PREVIEW_TOKEN;
  if (!token) {
    console.error('SANITY_PREVIEW_TOKEN is not configured');
    return res.status(500).json({ error: 'Preview unavailable' });
  }

  // The real @sanity/client so the response carries stega encoding.
  // Drafts perspective + a server-side token so unpublished edits show.
  const client = createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: API_VERSION,
    useCdn: false,
    perspective: 'drafts',
    token,
    stega: { enabled: true, studioUrl: STUDIO_URL },
  });

  try {
    const result = await client.fetch(QUERIES[type], { slug });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ result });
  } catch (err) {
    console.error('Preview draft fetch error:', type, err);
    return res.status(500).json({ error: 'Preview fetch failed' });
  }
}
