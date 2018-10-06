const debug = require("debug")("gc:siphon:db");

async function createIndexes({ gcs }) {
  debug("Creating geospatial index on geocaches");
  await gcs.createIndex({ coord: "2dsphere" });
  await gcs.createIndex({ discover_date: -1, api_date: 1 });
  await gcs.createIndex({ "parsed.quadKey": 1 });
}

module.exports = createIndexes;
