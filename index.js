const mongo = require("mongodb");

const prepare = require("./lib/prepare");
const discover = require("./lib/discover");
const processParse = require("./lib/parse");
const processFetch = require("./lib/apifetch");
const processLogs = require("./lib/logs");
const metrics = require("./lib/metrics");

async function main() {
  const url = process.env["GC_DB_URI"] || "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const areas = db.collection("areas");
  const gcs = db.collection("gcs");
  const users = db.collection("users");

  await metrics({ startup: 1 });

  // setup the database etc.
  await prepare({ areas, gcs });

  // find new geocache numbers based in pre-defined areas
  await discover({ areas, gcs });

  // download geocache information via Groundspeak API (requires authentication)
  await processFetch(gcs);

  // download geocache log information via Groundspeak API (requires authentication)
  await processLogs({ users, gcs });

  // parse/normalize geocache information
  await processParse(gcs);

  await client.close();
}

main().catch(err => {
  console.log(err);
  process.exit(-1);
});
