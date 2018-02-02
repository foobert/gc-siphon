const debug = require("debug")("gc-lookup");
const mongo = require("mongodb");

const discover = require("./lib/discover");
const processFetch = require("./lib/fetch");
const processParse = require("./lib/parse");
const processCoord = require("./lib/coord");

async function main() {
  const url = process.env["GC_DB_URI"] || "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const collection = db.collection("gcs");

  // find new GC numbers based in pre-defined areas
  await discover(db.collection("areas"), collection);

  // download geocache websites w/o authentication
  await processFetch(collection);

  // parse geocache websites (without coordinates)
  await processParse(collection);

  // download geocache coordintes (requires groundspeak account)
  await processCoord(collection);

  await client.close();
}

main().catch(err => {
  console.log(err);
  process.exit(-1);
});
