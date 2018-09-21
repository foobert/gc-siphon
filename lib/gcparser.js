const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { toTile, toQuadKey } = require("./quadtile");

const constants = require("./constants");

const PARSER_VERSION = calculateParserVersion();
const MAX_ZOOM = 16;

function calculateParserVersion() {
  // automatically re-parse documents when this file is updated
  // probably too much work, but parsing is fast
  const sha1 = crypto.createHash("sha1");
  const resolvePath = filename => path.join(path.dirname(__filename), filename);

  sha1.update(fs.readFileSync(__filename, "UTF-8"));
  sha1.update(fs.readFileSync(resolvePath("quadtile.js"), "UTF-8"));
  sha1.update(fs.readFileSync(resolvePath("constants.js"), "UTF-8"));
  return sha1.digest("hex").substr(0, 7);
}
function calculateFoundScore(geocacheLogs) {
  if (!geocacheLogs || geocacheLogs.length === 0) {
    // err on the side of reporting the cache
    return 1;
  }

  //  2: Found it
  //  3: Didn't find it
  //  4: Write Note
  //  5: Archive
  //  7: Needs Archived
  //  9: Will Attend
  // 10: Attended
  // 11: Webcam photo taken
  // 12: Unarchive
  // 22: Temporarily Disable Listing
  // 23: Enable Listing
  // 24: Publish Listing
  // 45: Needs Maintenance
  // 46: Owner Maintenance
  // 47: Update Coordinates
  // 68: Post Reviewer Note
  // 74: Event Announcement

  const isNegativeLog = log =>
    log.LogType && [3, 5, 7, 22, 45, 68].includes(log.LogType.WptLogTypeId);

  const finds = geocacheLogs
    .map((l, i) => isNegativeLog(l) * Math.pow(0.5, i))
    .reduce((s, x) => s - x, 1);
  return finds;
}

function parseSize(containerType) {
  if (!containerType) {
    return null;
  }
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
    case 5:
      return constants.size.VIRTUAL;
    default:
      return null;
  }
}

function parseType(cacheType) {
  if (!cacheType) {
    return null;
  }
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
    case 4:
      return constants.type.VIRTUAL;
    case 5:
      return constants.type.LETTERBOX;
    case 13:
      return constants.type.CITO;
    case 9:
      return constants.type.APE;
    case 11:
      return constants.type.WEBCAM;
    case 453:
      return constants.type.MEGAEVENT;
    case 1304:
      return constants.type.GPSADVENTURES;
    case 3773:
      return constants.type.GCHQ;
    case 7005:
      return constants.type.GIGAEVENT;
    default:
      return null;
  }
}

function parse(api) {
  if (api.IsPremium) {
    return { premium: true };
  }

  const quadTile = toTile(api.Latitude, api.Longitude, MAX_ZOOM);
  const quadKey = toQuadKey(quadTile.x, quadTile.y, MAX_ZOOM).join("");

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
    owner: api.Owner && api.Owner.UserName,
    premium: false,
    favpoints: api.FavoritePoints,
    quadTile,
    quadKey
  };
}

function parseCoord(api) {
  if (!api || !api.Longitude || !api.Latitude) {
    return null;
  }
  return {
    type: "Point",
    coordinates: [api.Longitude, api.Latitude]
  };
}

module.exports = {
  parse,
  parseCoord,
  PARSER_VERSION
};
