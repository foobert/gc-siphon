const mongo = require("mongodb");
const request = require("superagent");

const prepare = require("./lib/prepare");
const discover = require("./lib/discover");
const processParse = require("./lib/parse");
const processFetch = require("./lib/apifetch");

async function main() {
  const url = process.env["GC_DB_URI"] || "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const areas = db.collection("areas");
  const gcs = db.collection("gcs");

  // setup the database etc.
  await prepare({ areas, gcs });

  // find new geocache numbers based in pre-defined areas
  await discover({ request, areas, gcs });

  // download geocache information via Groundspeak API (requires authentication)
  await processFetch(gcs);

  // parse/normalize geocache information
  await processParse(gcs);

  await client.close();
}

main().catch(err => {
  console.log(err);
  process.exit(-1);
});
