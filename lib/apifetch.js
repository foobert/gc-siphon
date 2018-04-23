const debug = require("debug")("gc:siphon:apifetch");
const request = require("superagent");

const { daysAgo } = require("./util");
const { login, canLogin } = require("./login");

const ABSOLUTE_LIMIT = 2000;
const REQUEST_LIMIT = 50;

async function getUpdatedToday(collection) {
  return await collection.count({
    api_date: { $gte: daysAgo(1) }
  });
}

function getTodo(collection) {
  return collection.find({
    $or: [{ api: { $exists: false } }, { api_date: { $lt: daysAgo(7) } }]
  });
}

function getNextBatch(collection, todayLimit) {
  return getTodo(collection)
    .sort({ api_date: 1 })
    .limit(Math.min(REQUEST_LIMIT, todayLimit))
    .toArray();
}

async function fetchDocs(docs, accessToken) {
  const cacheCodes = docs.map(doc => doc._id);
  debug("Fetch %o using %s", cacheCodes, accessToken);
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
      MaxPerPage: REQUEST_LIMIT,
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

async function processApi(collection) {
  if (!canLogin()) {
    debug(
      "Skipping coordinate update. Missing GC_USERNAME, GC_PASSWORD, and GC_CONSUMER_KEY"
    );
    return;
  }

  debug("Updating geocaches (via API)");
  const updatedToday = await getUpdatedToday(collection);
  const todoCount = await getTodo(collection);
  const todayLimit = ABSOLUTE_LIMIT - updatedToday;
  debug("Already updated in the last 24 hrs: %d", updatedToday);
  debug("Limit: %d/%d = %d", updatedToday, ABSOLUTE_LIMIT, todayLimit);
  debug("Todo: %d", todoCount);

  let accessToken = null;
  let fetchCount = 0;
  while (fetchCount < todayLimit) {
    const docs = await getNextBatch(collection, todayLimit - fetchCount);
    fetchCount += docs.length;
    if (docs.length === 0) {
      debug("Nothing needs updating");
      break;
    }
    debug("Need to fetch %d geocaches", docs.length);
    if (!accessToken) {
      accessToken = await login();
    }
    try {
      let updatedDocs = await fetchDocs(docs, accessToken);
      for (let updatedDoc of updatedDocs) {
        // TODO updateMany?
        //debug("Update %s", updatedDoc._id);
        await collection.update(
          { _id: updatedDoc._id },
          { $set: updatedDoc },
          { upsert: true }
        );
      }
    } catch (err) {
      debug("Error while updating %d docs: %o", docs.length, err);
      return;
    }
  }
}

module.exports = processApi;
