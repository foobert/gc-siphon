const debug = require("debug")("gc:siphon:parse");

const { parse, parseCoord, PARSER_VERSION } = require("./gcparser");
const metrics = require("./metrics");

function getTodoDocuments(collection) {
  return collection.find({ parsed_refresh: true }).limit(1000);
}

function createUpdateOp(doc, now) {
  return {
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          parsed: parse(doc.api),
          parsed_date: now,
          parsed_version: PARSER_VERSION,
          parsed_refresh: null,
          coord: parseCoord(doc.api),
          coord_date: now
        }
      },
      upsert: true
    }
  };
}
async function flushBuffer(collection, buffer) {
  if (buffer.length === 0) return;
  debug("Updating %d documents", buffer.length);
  await collection.bulkWrite(buffer, { ordered: false });
  metrics.increment("parse.gcs", buffer.length);
  buffer.length = 0;
}

async function process(collection) {
  debug("Parsing geocaches (version: %s)", PARSER_VERSION);

  let buffer = [];
  let count = 0;
  let docs = [];
  const now = new Date();
  const maxBufferSize = 100;
  do {
    docs = await getTodoDocuments(collection).toArray();
    for (let doc of docs) {
      count++;
      const op = createUpdateOp(doc, now);
      if (buffer.length < maxBufferSize) {
        buffer.push(op);
      } else {
        await flushBuffer(collection, buffer);
      }
    }
  } while (docs.length > 0);
  await flushBuffer(collection, buffer);
  debug("Parsed %d geocaches", count);
}

module.exports = process;
