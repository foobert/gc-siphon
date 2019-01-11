const mongo = require("mongodb");

const prepare = require("./lib/prepare");
const discover = require("./lib/discover");
const processParse = require("./lib/parse");
const processFetch = require("./lib/apifetch");
const processLogs = require("./lib/logs");
const metrics = require("./lib/metrics");
const g2fetch = require("./lib/g2fetch");
const stats = require("./lib/stats");

async function main() {
  const url = process.env["GC_DB_URI"] || "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const areas = db.collection("areas");
  const gcs = db.collection("gcs");
  const users = db.collection("users");

  // let metrics know we're here
  metrics.increment("startup");

  // setup the database etc.
  await prepare({ areas, gcs });

  // find new geocache numbers based in pre-defined areas
  await discover({ areas, gcs });

  // download geocache information via G2 database (requires GC_G2_URI)
  await g2fetch({ gcs });

  // download geocache information via Groundspeak API (requires authentication)
  await processFetch({ areas, gcs });

  // download geocache log information via Groundspeak API (requires authentication)
  await processLogs({ users, gcs });

  // parse/normalize geocache information
  await processParse(gcs);

  // publish some statistics
  await stats({ gcs });

  await client.close();
}

main().catch(err => {
  console.log(err);
  process.exit(-1);
});
