const debug = require("debug")("gc:siphon:db");

async function createIndexes({ gcs }) {
  debug("Creating geospatial index on geocaches");
  await gcs.createIndex({ coord: "2dsphere" });
}

module.exports = createIndexes;
