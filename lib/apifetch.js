const debug = require("debug")("gc-lookup");
const request = require("superagent");

const { daysAgo } = require("./util");

async function update(collection, query, mapper) {
  let accessToken = null;
  while (true) {
    const docs = await collection
      .find(query)
      .limit(50)
      .toArray();
    if (docs.length === 0) {
      debug("Nothing needs updating");
      return;
    }
    debug("Need to update %d documents", docs.length);
    if (!accessToken) {
      accessToken = await login();
    }
    try {
      let updatedDocs = await Promise.resolve(mapper(docs, accessToken));
      for (let updatedDoc of updatedDocs) {
        // TODO updateMany?
        debug("Update %s", updatedDoc._id);
        await collection.update(
          { _id: updatedDoc._id },
          { $set: updatedDoc },
          { upsert: true }
        );
      }
    } catch (err) {
      debug("Error while updating %d docs: %s", docs.length, err.message);
    }
  }
}

async function fetchDocs(docs, accessToken) {
  const cacheCodes = docs.map(doc => doc._id);
  debug("fetch %o using %s", cacheCodes, accessToken);
  const res = await request
    .post(
      "https://api.groundspeak.com/LiveV6/Geocaching.svc/internal/SearchForGeocaches"
    )
    .accept("json")
    .query({ format: "json" })
    .send({
      AccessToken: accessToken,
      CacheCode: { CacheCodes: cacheCodes },
      GeocacheLogCount: 5,
      IsLite: false,
      MaxPerPage: 50,
      TrackableLogCount: 0
    });
  debug("Search: %d", res.status);

  const fetched = res.body.Geocaches.map(geocache => {
    return {
      _id: geocache.Code,
      api: geocache,
      api_date: new Date()
    };
  });
  // ugh, ugly hack
  for (let gc of cacheCodes) {
    if (!fetched.find(x => x._id === gc)) {
      debug("Missing %s in results, probably a premium geocache", gc);
      fetched.push({ _id: gc, api: { IsPremium: true }, api_date: new Date() });
    }
  }
  return fetched;
}

async function login() {
  debug("Logging in");
  const res = await request
    .post("https://api.groundspeak.com/LiveV6/Geocaching.svc/internal/Login")
    .accept("json")
    .query({ format: "json" })
    .send({
      ConsumerKey: process.env.GC_CONSUMER_KEY,
      UserName: process.env.GC_USERNAME,
      Password: process.env.GC_PASSWORD
    });
  const accessToken = res.body.GroundspeakAccessToken;
  debug("Access token: %s", accessToken);
  return accessToken;
}

async function processApi(collection) {
  if (
    !process.env.GC_USERNAME ||
    !process.env.GC_PASSWORD ||
    !process.env.GC_CONSUMER_KEY
  ) {
    debug(
      "Skipping coordinate update. Missing GC_USERNAME, GC_PASSWORD, and GC_CONSUMER_KEY"
    );
    return;
  }

  debug("Updating geocaches (via API)");
  const fresh = false;
  const query = fresh
    ? {}
    : {
        $or: [{ api: { $exists: false } }, { api_date: { $lt: daysAgo(60) } }]
      };
  await update(collection, query, fetchDocs);
}

module.exports = processApi;
