const crypto = require("crypto");
const debug = require("debug")("gc-lookup");
const fs = require("fs");

const constants = require("./constants");

const PARSER_VERSION = calculateParserVersion();

function calculateParserVersion() {
  // automatically re-parse documents when this file is updated
  // probably too much work, but parsing is fast
  const sha1 = crypto.createHash("sha1");
  sha1.update(fs.readFileSync(__filename, "UTF-8"));
  return sha1.digest("hex").substr(0, 7);
}

function calculateFoundScore(geocacheLogs) {
  if (!geocacheLogs || geocacheLogs.length === 0) {
    // err on the side of reporting the cache
    return 1;
  }

  const finds = geocacheLogs.filter(l => l.LogType.WptLogTypeId === 2);
  return finds.length / geocacheLogs.length;
}

function parseSize(containerType) {
  switch (containerType.ContainerTypeId) {
    case 1:
      return constants.size.NOT_CHOSEN;
    case 2:
      return constants.size.MICRO;
    case 3:
      return constants.size.REGULAR;
    case 4:
      return constants.size.LARGE;
    case 6:
      return constants.size.OTHER;
    case 8:
      return constants.size.SMALL;
    default:
      return null;
  }
}

function parseType(cacheType) {
  switch (cacheType.GeocacheTypeId) {
    case 2:
      return constants.type.TRADITIONAL;
    case 1858:
      return constants.type.WHERIGO;
    case 6:
      return constants.type.EVENT;
    case 8:
      return constants.type.MYSTERY;
    case 3:
      return constants.type.MULTI;
    case 137:
      return constants.type.EARTH;
    default:
      return null;
  }
}

function parse(gc, api) {
  //debug("Parse %s", gc);
  if (api.IsPremium) {
    return { premium: true };
  }

  return {
    name: api.Name,
    lat: api.Latitude,
    lon: api.Longitude,
    difficulty: api.Difficulty,
    terrain: api.Terrain,
    size: parseSize(api.ContainerType),
    hint: api.EncodedHints,
    type: parseType(api.CacheType),
    disabled: !(api.Available && !api.Archived),
    foundScore: calculateFoundScore(api.GeocacheLogs),
    premium: false
  };
}

function parseCoord(gc, api) {
  return { lat: api.Latitude, lon: api.Longitude };
}

async function process(collection) {
  debug("Parsing geocaches (version: %s)", PARSER_VERSION);

  while (true) {
    const docs = await collection
      .aggregate([
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

    if (docs.length === 0) {
      // Nothing left to parse
      break;
    }

    debug("Parsing %d documents", docs.length);
    try {
      const updateOps = docs.map(doc => {
        const now = new Date();
        return {
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                parsed: parse(doc.gc, doc.api),
                parsed_date: now,
                parsed_version: PARSER_VERSION,
                // coord parsing is a left-over from downloading websites
                coord: parseCoord(doc.gc, doc.api),
                coord_date: now
              }
            },
            upsert: true
          }
        };
      });
      await collection.bulkWrite(updateOps, { ordered: false });
    } catch (err) {
      debug("Error while updating %d documents: %s", docs.length, err.message);
    }
  }
}

module.exports = process;
