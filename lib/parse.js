const debug = require("debug")("gc:siphon:parse");

const { parse, parseCoord, PARSER_VERSION } = require("./gcparser");
const metrics = require("./metrics");

function getTodoDocuments(collection) {
  return collection.aggregate([
    { $match: { api: { $exists: true } } },
    {
      $project: {
        api: 1,
        parsed_date: 1,
        parsed_version: 1,
        need_parse_api: { $cmp: ["$api_date", "$parsed_date"] }
      }
    },
    {
      $match: {
        $or: [
          { parsed_date: { $exists: false } },
          { parsed_version: { $exists: false } },
          { parsed_version: { $ne: PARSER_VERSION } },
          { need_parse_api: 1 }
        ]
      }
    }
  ]);
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
  metrics({ parse: buffer.length });
  buffer.length = 0;
}

async function process(collection) {
  debug("Parsing geocaches (version: %s)", PARSER_VERSION);

  try {
    const maxBufferSize = 100;
    const now = new Date();
    const cursor = getTodoDocuments(collection).batchSize(maxBufferSize);
    let doc;
    let buffer = [];
    let count = 0;

    while ((doc = await cursor.next()) != null) {
      count++;
      const op = createUpdateOp(doc, now);
      if (buffer.length < maxBufferSize) {
        buffer.push(op);
      } else {
        await flushBuffer(collection, buffer);
      }
    }
    await flushBuffer(collection, buffer);
    debug("Parsed %d geocaches", count);
  } catch (err) {
    debug("Error while parsing: %o", err);
    return;
  }
}

module.exports = process;
