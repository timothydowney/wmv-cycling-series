# WMV Explorer Seasons Design Workshop Checklist

Use this checklist to drive the next planning and UX rounds without reopening settled product decisions.

## Confirmed Decisions

- Explorer is season-first, not week-first, for the initial release.
- Only one Explorer season is active at a time.
- Explorer and competition remain separate product models.
- Riders are opted into Explorer by default and can opt out from their profile.
- Deleted or invalidated activities must remove Explorer completion when appropriate.
- The first athlete-facing experience is data-first rather than map-first.

## Stats Workshop

- Confirm the exact day-one athlete-facing stat set.
- Decide how to present most popular and least popular destinations when ties occur.
- Decide whether “least popular” excludes destinations with zero completions or should be paired with “never visited.”
- Decide when unique-discovery stats should move from follow-on into the athlete-facing view.
- Decide whether archive pages should show the same stat set as active seasons.

## Destination Modeling Workshop

- Define what “route family” means for admins in practical terms.
- Decide whether route family is free text, admin-defined picklist, or deferred metadata.
- Decide whether commentary appears inline in the destination list, in a drawer, or on a detail card later.
- Decide whether commentary needs images later, or whether markdown text is enough for the first pass.
- Decide whether future place destinations should auto-publish, require admin approval, or land in a draft queue.
- Decide how a normalized place key should behave when city naming is inconsistent across Strava and a geocoder.
- Refine the chosen hybrid destination presentation model: admin-authored place label as primary, with endpoint or place context as supporting detail.
- Decide what spatial tolerance would still feel trustworthy if endpoint-confidence matching is introduced later.

## Map Workshop

- Confirm the long-term map stack direction.
- Decide when a map becomes worth prioritizing after the data-first launch.
- Decide how to visually handle virtual segments with odd real-world placement.
- Decide whether the first map should show markers only or segment paths too.
- Decide whether archived seasons should eventually get their own map views.
- Decide what provider fallback is acceptable if public OSM tiles or Nominatim-style geocoding become too limited.

## Feed Workshop

- Decide the minimum completion provenance needed to support a later personal feed cleanly.
- Decide whether the personal feed should group by activity or by destination completion.
- Decide how much social visibility is acceptable before introducing a shared Explorer feed.

## Admin Workflow Workshop

- Decide how season replication should work when it is introduced.
- Decide what gets cloned by default: destinations, commentary, route families, ordering.
- Decide how rider-submitted destinations should be reviewed and approved later.
- Decide whether admins need a destination draft state before a season is activated.
- Decide whether future auto-generated place destinations should be editable in the same admin workflow as curated segment destinations.
- Decide what admins should see when a segment source later becomes unavailable for new matches.

## Delivery Workshop

- Decide when to revisit caching if runtime aggregation remains acceptable.
- Decide what product signals would justify moving map or feed work ahead of other follow-on items.
- Decide which early Explorer analytics matter most to learn whether the feature is working.
- Decide what data-quality threshold is required before enabling automatic place-destination creation.
- Decide what evidence would justify moving from exact segment matching to a lower-confidence geospatial matching model.