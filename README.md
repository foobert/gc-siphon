# Lookup

The pipeline to discover and download/parse geocaches.

(Probably needs to be renamed)

Steps involved:

1. Find GC numbers based on an area
2. Download geocache information via Groundspeak API
3. Download log information via Groundspeak API
4. Parse/normalize data

No API is currently exposed, you'll need direct database access.
See graphql for an expirmental take on that.

There is no async job queue or anything. The script is meant to be run via cron
once a day or so and will look for stale/outdated information to update. The
geocache download is limited per 24hrs and can be safely run multiple times.

To access Groundspeak API information, you need to have your login credentials in
`GC_USERNAME`, `GC_PASSWORD`, and `GC_CONSUMER_KEY`.
