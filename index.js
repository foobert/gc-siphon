const debug = require("debug")("gc-lookup");
const mongo = require("mongodb");

const processFetch = require("./lib/fetch");
const processParse = require("./lib/parse");
const processCoord = require("./lib/coord");

async function main() {
  const url = "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const collection = db.collection("gcs");

  await processFetch(collection);
  await processParse(collection);
  await processCoord(collection);

  await client.close();
}

main();
