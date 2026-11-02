/* ============================================================
   SWG Circular: the shared GROQ for reading an issue.
   js/circular-query.js

   One definition used by the website (js/sanity.js), the Visual
   Editor's draft preview (api/preview-doc.js) and, later, the Kit email
   builder, so all three always read an issue in exactly the same shape.
   Plain strings only: no imports, so both the bundled site code and the
   unbundled serverless functions can use it.
   ============================================================ */

// Everything an issue page, its piece pages and the email need, with
// referenced documents (feature story, writer portraits, linked pages)
// pulled in so the page needs no second round of fetching.
export const CIRCULAR_ISSUE_PROJECTION = `{
  _id, _type, issueNumber, issueLabel, seasonName, tagline, issueDate,
  presenterLine, publicationTitle,
  "coverUrl": coalesce(
    coverImage.asset->url,
    blocks[_type == "circularFeature"][0].image.asset->url,
    blocks[_type == "circularFeature"][0].story->thumbnail.asset->url,
    blocks[_type == "circularFeature"][0].story->thumbnailUrl,
    legacyPage->thumbnail.asset->url,
    legacyPage->thumbnailUrl
  ),
  "legacy": legacyPage->{ title, "slug": slug.current, excerpt },
  blocks[]{
    ...,
    _type == "circularFeature" => {
      "imageUrl": image.asset->url,
      "story": story->{
        _id, title, "slug": slug.current, authors, excerpt,
        "imageUrl": coalesce(thumbnail.asset->url, thumbnailUrl),
        "opening": body[_type == "block" && length(pt::text(@)) > 0][0...8]{ "text": pt::text(@) }.text
      }
    },
    _type == "circularTeasers" => {
      entries[]{
        ...,
        "portraitUrl": writer->avatarPhoto.asset->url,
        "imageUrl": image.asset->url,
        "link": link{ url, "page": page->{ _type, title, characterName, "slug": slug.current } }
      }
    },
    _type == "circularLinkList" => {
      items[]{
        ...,
        "imageUrl": image.asset->url,
        "link": link{ url, "page": page->{
          _type, title, characterName, authors, "slug": slug.current,
          "imageUrl": coalesce(thumbnail.asset->url, thumbnailUrl, coverImage.asset->url, avatarPhoto.asset->url)
        } }
      }
    },
    _type == "circularSignOff" => {
      "people": select(
        count(writers) > 0 => writers[]{
          "name": coalesce(name, writer->characterName),
          "slug": writer->slug.current,
          "photoUrl": writer->avatarPhoto.asset->url
        },
        *[_type == "writer"] | order(displayOrder asc){
          "name": characterName, "slug": slug.current, "photoUrl": avatarPhoto.asset->url
        }
      )
    }
  }
}`

// The short form used by the homepage and the archive (one card per issue).
export const CIRCULAR_CARD_PROJECTION = `{
  _id, issueNumber, issueLabel, seasonName, tagline, issueDate, publicationTitle,
  "coverUrl": coalesce(
    coverImage.asset->url,
    blocks[_type == "circularFeature"][0].image.asset->url,
    blocks[_type == "circularFeature"][0].story->thumbnail.asset->url,
    blocks[_type == "circularFeature"][0].story->thumbnailUrl,
    legacyPage->thumbnail.asset->url,
    legacyPage->thumbnailUrl
  ),
  "legacy": legacyPage->{ title, "slug": slug.current, excerpt }
}`

// An issue is addressed by its number, padded to two digits: /circular/02/.
// $issue is that address segment ("02" or "2").
export const CIRCULAR_ISSUE_BY_ADDRESS = `*[_type == "circularIssue" && (string(issueNumber) == $issue || "0" + string(issueNumber) == $issue)][0]${CIRCULAR_ISSUE_PROJECTION}`
