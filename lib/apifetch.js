const debug = require("debug")("gc:siphon:apifetch");
const request = require("superagent");
const turf = require("@turf/turf");

const { daysAgo, hoursAgo } = require("./util");
const { login, canLogin } = require("./login");
const metrics = require("./metrics");

const ABSOLUTE_LIMIT = 2000;
const REQUEST_LIMIT = 50;

async function getUpdatedToday(collection) {
  return await collection.count({
    api_date: { $gte: hoursAgo(23) }
  });
}

function todoQuery(priorityGeometry) {
  const query = {
    $or: [
      { api: { $exists: false } },
      {
        "api.Archived": false,
        "api.IsPremium": { $ne: true },
        api_date: { $lt: daysAgo(7) }
      },
      { "api.Archived": true, api_date: { $lt: daysAgo(90) } },
      { "api.IsPremium": true, api_date: { $lt: daysAgo(90) } }
    ]
  };

  if (priorityGeometry) {
    return {
      $and: [query, { coord: { $geoWithin: { $geometry: priorityGeometry } } }]
    };
  } else {
    return query;
  }
}

function getTodo(collection, priorityGeometry) {
  return collection.count(todoQuery(priorityGeometry));
}

function getNextBatch(collection, priorityGeometry, todayLimit) {
  return collection
    .find(todoQuery(priorityGeometry))
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

async function getPriorityGeometry(areas) {
  const docs = await areas.find({}, { projection: { geometry: 1 } }).toArray();
  // the mongodb driver supports .map() directly on the cursor, but mongomock
  // does not
  const geometries = docs.map(x => turf.feature(x.geometry));
  if (geometries.length === 0) {
    return null;
  }
  const { geometry } = turf.union(...geometries);
  return geometry;
}

async function processApi({ areas, gcs }) {
  if (!canLogin()) {
    debug(
      "Skipping coordinate update. Missing GC_USERNAME, GC_PASSWORD, and GC_CONSUMER_KEY"
    );
    return;
  }

  debug("Updating geocaches (via API)");
  const updatedToday = await getUpdatedToday(gcs);
  const todoCount = await getTodo(gcs);
  const todayLimit = ABSOLUTE_LIMIT - updatedToday;
  debug("Already updated in the last 24 hrs: %d", updatedToday);
  debug("Limit: %d/%d = %d", updatedToday, ABSOLUTE_LIMIT, todayLimit);
  debug("Todo: %d", todoCount);

  try {
    let accessToken = null;
    let fetchCount = 0;
    let priorityGeometry = await getPriorityGeometry(areas);
    while (fetchCount < todayLimit) {
      const docs = await getNextBatch(
        gcs,
        priorityGeometry,
        todayLimit - fetchCount
      );
      fetchCount += docs.length;
      if (docs.length === 0 && priorityGeometry) {
        debug("Switching to non-priorityGeometry");
        priorityGeometry = null;
        continue;
      }
      if (docs.length === 0) {
        debug("Nothing needs updating");
        break;
      }
      debug("Need to fetch %d geocaches", docs.length);
      if (!accessToken) {
        accessToken = await login();
      }
      let updatedDocs = await fetchDocs(docs, accessToken);
      for (let updatedDoc of updatedDocs) {
        // TODO updateMany?
        //debug("Update %s", updatedDoc._id);
        await gcs.update(
          { _id: updatedDoc._id },
          { $set: updatedDoc },
          { upsert: true }
        );
      }
    }
    metrics({
      fetch: { todo: todoCount, limit: todayLimit, count: fetchCount }
    });
  } catch (err) {
    debug("Error while fetching: %o", err);
  }
}

module.exports = processApi;
