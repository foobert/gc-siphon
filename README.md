# Lookup

The pipeline to discover and download/parse geocaches.

(Probably needs to be renamed)

Steps involved:

1. Find GC numbers based on an area
2. Download geocache websites
3. Parse geocache websites
4. Download geocache coordinates (requires an account)

No API is currently exposed, you'll need direct database access.
See graphql for an expirmental take on that.

There is no async job queue or anything. The script is meant to be run via cron
once a day or so and will look for stale/outdated information to update.
