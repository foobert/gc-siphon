const debug = require("debug")("gc:siphon:parse");

const { parse, parseCoord, PARSER_VERSION } = require("./gcparser");

async function getNextBatch(collection) {
  return await collection
    .aggregate([
      { $match: { api: { $exists: true }, gc: { $exists: true } } },
      {
        $project: {
          gc: 1,
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
      },
      { $limit: 100 }
    ])
    .toArray();
}

function createUpdateOp(doc) {
  const now = new Date();
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

async function process(collection) {
  debug("Parsing geocaches (version: %s)", PARSER_VERSION);

  for (;;) {
    const docs = getNextBatch();
    if (docs.length === 0) {
      // Nothing left to parse
      break;
    }

    debug("Parsing %d documents", docs.length);
    try {
      const updateOps = docs.map(createUpdateOp);
      await collection.bulkWrite(updateOps, { ordered: false });
    } catch (err) {
      debug("Error while updating %d documents: %s", docs.length, err.message);
    }
  }
}

module.exports = process;
