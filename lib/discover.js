const assert = require("assert");
const _ = require("lodash");
const debug = require("debug")("gc:siphon:discover");
const request = require("superagent");
const turf = require("@turf/turf");

const { hoursAgo } = require("./util");
const { toBoundingBox, toTiles } = require("./tiles");
const metrics = require("./metrics");

async function fetchTile(tile) {
  const number = Math.floor(Math.random() * 4) + 1;
  const server = `https://tiles0${number}.geocaching.com`;

  // it seems that we need to request the tile image first,
  // otherwise the map.info data is empty
  await request
    .get(`${server}/map.png`)
    .accept("*/*")
    .query({ x: tile.x, y: tile.y, z: tile.z });

  const res = await request
    .get(`${server}/map.info`)
    .accept("json")
    .query({ x: tile.x, y: tile.y, z: tile.z });

  if (!res.ok) {
    throw new Error("Unable to fetch tile");
  }

  if (!res.body.data && res.status != 204) {
    // most likely because Groundspeak refused us data
    debug("Received empty tile %o", tile);
    throw new Error("Empty tile data");
  }

  let datas = _.values(res.body.data);
  let flat = _.flatMap(datas, data => data.map(d => d.i));
  let gcs = _.uniq(flat);

  return gcs;
}

async function discoverGeometry(geometry, collection) {
  // must at least zoom 12, because groundspeak drops
  // geocaches from the results otherwise
  let tiles = toTiles(geometry, 12);
  let count = 0;
  debug("Need to fetch %d tiles", tiles.length);
  for (let tile of tiles) {
    let now = new Date();
    let gcs = await fetchTile(tile);
    let bbox = toBoundingBox(tile);
    count += gcs.length;

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
  metrics.increment("discover.tile", tiles.length);
  metrics.increment("discover.gc", count);
  return count;
}

async function discoverGeocaches({ areas, gcs }) {
  debug("Discovering Geocaches");
  const docs = await areas
    .find({
      $or: [
        { discover_date: { $exists: false } },
        { discover_date: { $lt: hoursAgo(23) }, one_shot: { $ne: true } }
      ],
      inactive: { $ne: true }
    })
    .sort("discover_date", 1)
    .toArray();

  for (let doc of docs) {
    debug("Discovering %s", doc.name);
    let count = await discoverGeometry(doc.geometry, gcs);
    await areas.update(
      { _id: doc._id },
      { $set: { discover_date: new Date(), count } }
    );
  }
}

module.exports = discoverGeocaches;
