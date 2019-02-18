const debug = require("debug")("gc:siphon:db");

async function createIndexes({ gcs }) {
  debug("Creating geospatial index on geocaches");
  await gcs.createIndex({ coord: "2dsphere" });
  await gcs.createIndex({ discover_date: -1, api_date: 1 });
  await gcs.createIndex({ "parsed.quadKey": 1 });
  // various indexes for faster fetch todo lookups
  await gcs.createIndex({ "api.Code": 1 });
  await gcs.createIndex({ "api.IsPremium": 1, api_date: 1 });
  await gcs.createIndex({ "api.IsArchived": 1, api_date: 1 });
  await gcs.createIndex({
    "api.IsArchived": 1,
    "api.IsPremium": 1,
    api_date: 1
  });
}

module.exports = createIndexes;
