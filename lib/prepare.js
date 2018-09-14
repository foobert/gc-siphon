const debug = require("debug")("gc:siphon:db");

async function createIndexes({ gcs }) {
  debug("Creating geospatial index on geocaches");
  await gcs.createIndex({ coord: "2dsphere" });
  await gcs.createIndex({ api_date: 1, discover_date: -1 });
}

module.exports = createIndexes;
