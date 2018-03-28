const debug = require("debug")("gc:lookup:apifetch");
const request = require("superagent");

const { ageLabel, daysAgo } = require("./util");
const { login, canLogin } = require("./login");

const ABSOLUTE_LIMIT = 2000;
const REQUEST_LIMIT = 50;

async function getUpdatedToday(collection) {
  return await collection.count({
    api_date: { $gte: daysAgo(1) }
  });
}

async function update(collection, query, mapper) {
  const updatedToday = await getUpdatedToday(collection);
  const todoCount = await collection.count(query);
  const todayLimit = ABSOLUTE_LIMIT - updatedToday;
  debug("Already updated in the last 24 hrs: %d", updatedToday);
  debug("Limit: %d/%d = %d", updatedToday, ABSOLUTE_LIMIT, todayLimit);
  debug("Todo: %d", todoCount);

  let accessToken = null;
  let fetchCount = 0;
  while (fetchCount < todayLimit) {
    const docs = await collection
      .find(query)
      .sort({ api_date: 1 })
      .limit(REQUEST_LIMIT)
      .toArray();
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
      let updatedDocs = await Promise.resolve(mapper(docs, accessToken));
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
      debug("Error while updating %d docs: %s", docs.length, err.message);
    }
  }
  return { fetched: fetchCount, todo: todoCount };
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

async function report(collection, { fetched: updateCount, todo: todoCount }) {
  console.log("Geocaches:");
  const docs = await collection
    .aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$api_date" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ])
    .toArray();
  for (const doc of docs) {
    console.log(
      "%s last updated %s",
      doc.count.toString().padStart(6),
      ageLabel(doc._id)
    );
  }
  console.log(
    "%s updated during this execution",
    updateCount.toString().padStart(6)
  );
  console.log("%s left todo", todoCount.toString().padStart(6));
}

async function processApi(collection) {
  if (!canLogin()) {
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
        $or: [{ api: { $exists: false } }, { api_date: { $lt: daysAgo(7) } }]
      };
  const stats = await update(collection, query, fetchDocs);
  await report(collection, stats);
}

module.exports = processApi;
