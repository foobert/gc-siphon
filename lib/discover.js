const _ = require("lodash");
const assert = require("assert");
const debug = require("debug")("gc-lookup");
const request = require("superagent");
const util = require("util");

const { daysAgo } = require("./util");

function toTile(lat, lon) {
  const zoom = 11;
  const latRad = lat * Math.PI / 180;
  const n = Math.pow(2, zoom);
  const xtile = parseInt((lon + 180.0) / 360.0 * n);
  const ytile = parseInt(
    (1.0 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2.0 *
      n
  );
  return { x: xtile, y: ytile, z: zoom };
}

function toCoordinates(tile) {
  const n = Math.pow(2, tile.z);
  const lon = tile.x / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * tile.y / n)));
  const lat = latRad / Math.PI * 180;
  return { lat, lon };
}

function toBoundingBox(tile) {
  const topLeft = toCoordinates(tile);
  const bottomRight = toCoordinates({
    x: tile.x + 1,
    y: tile.y + 1,
    z: tile.z
  });
  return [topLeft, bottomRight];
}

function toTiles(a, b) {
  const tileA = toTile(a.lat, a.lon);
  const tileB = toTile(b.lat, b.lon);

  assert(tileA.z, tileB.z, "Zoom level must match");

  const topLeft = {
    x: Math.min(tileA.x, tileB.x),
    y: Math.min(tileA.y, tileB.y)
  };
  const bottomRight = {
    x: Math.max(tileA.x, tileB.x),
    y: Math.max(tileA.y, tileB.y)
  };
  const z = tileA.z;

  let tiles = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y, z });
    }
  }
  return tiles;
}

async function fetchTile(tile) {
  const number = Math.floor(Math.random() * 4) + 1;
  const server = `https://tiles0${number}.geocaching.com/`;

  const res = await request
    .get(`${server}/map.info`)
    .accept("json")
    .query({ x: tile.x, y: tile.y, z: tile.z });

  if (!res.ok) {
    throw new Error("Unable to fetch tile");
  }

  let datas = _.values(res.body.data);
  let flat = _.flatMap(datas, data => data.map(d => d.i));
  let gcs = _.uniq(flat);

  return gcs;
}

async function needUpdate(tile, collection) {
  const fresh = false;
  if (fresh) {
    return true;
  }

  const existingGcs = await collection
    .find({ tile, discover_date: { $gte: daysAgo(1) } })
    .count();

  if (existingGcs == 0) {
    return true;
  }

  debug("Tile %o %d existing geocaches, skipping discover", tile, existingGcs);
  return false;
}

async function discoverBoundingBox(bbox, collection) {
  let tiles = toTiles(bbox[0], bbox[1]);
  for (let tile of tiles) {
    let now = new Date();
    let gcs = await fetchTile(tile);
    let bbox = toBoundingBox(tile);

    debug("Tile %o %d geocaches", tile, gcs.length);

    // TODO updateMany?
    for (let gc of gcs) {
      await collection.update(
        { _id: gc },
        { $set: { gc, tile, bbox, discover_date: now } },
        { upsert: true }
      );
    }
  }
}

async function discoverGeocaches(areas, gcs) {
  debug("Discovering Geocaches");
  const fresh = false;
  const query = fresh
    ? {}
    : {
        $or: [
          { discover_date: { $exists: false } },
          { discover_date: { $lt: daysAgo(1) } }
        ]
      };
  const docs = await areas.find(query).toArray();

  for (let doc of docs) {
    debug("Discovering %s", doc.name);
    await discoverBoundingBox(doc.bbox, gcs);
    areas.update({ _id: doc._id }, { $set: { discover_date: new Date() } });
  }
}

module.exports = discoverGeocaches;
