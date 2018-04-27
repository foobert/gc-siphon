# Geocache Siphon

[![Build Status](https://travis-ci.org/foobert/gc-siphon.svg?branch=master)](https://travis-ci.org/foobert/gc-siphon)
[![Greenkeeper badge](https://badges.greenkeeper.io/foobert/gc-siphon.svg)](https://greenkeeper.io/)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/903775268bcc482fa26a53a3c7978add)](https://www.codacy.com/app/foobert/gc-siphon)
[![Codacy Badge](https://api.codacy.com/project/badge/Coverage/903775268bcc482fa26a53a3c7978add)](https://www.codacy.com/app/foobert/gc-siphon)

A pipeline to discover, download and parse geocaches.

Steps involved:

1. Find GC numbers based on an area
2. Download geocache information via Groundspeak API
3. Download log information via Groundspeak API
4. Parse/normalize data

No API is exposed, you'll need direct database access.

This script is meant to be run via cron once a day or so and will look for
stale/outdated information to update. The geocache download count is limited per
24hrs.

To access Groundspeak API information, you need to have your login credentials in
`GC_USERNAME`, `GC_PASSWORD`, and `GC_CONSUMER_KEY`.
