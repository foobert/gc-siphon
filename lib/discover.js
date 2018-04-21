const _ = require("lodash");
const debug = require("debug")("gc:siphon:discover");
const request = require("superagent");

const { daysAgo } = require("./util");
const { toBoundingBox, toTiles } = require("./tiles");

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

async function discoverBoundingBox(bbox, collection) {
  // must at least zoom 12, because groundspeak drops
  // geocaches from the results otherwise
  let tiles = toTiles(bbox[0], bbox[1], 12);
  debug("Need to fetch %d tiles", tiles.length);
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

async function discoverGeocaches({ areas, gcs }) {
  debug("Discovering Geocaches");
  const docs = await areas
    .find({
      $or: [
        { discover_date: { $exists: false } },
        { discover_date: { $lt: daysAgo(1) } }
      ]
    })
    .sort("discover_date", 1)
    .toArray();

  for (let doc of docs) {
    debug("Discovering %s", doc.name);
    await discoverBoundingBox(doc.bbox, gcs);
    await areas.update(
      { _id: doc._id },
      { $set: { discover_date: new Date() } }
    );
  }
}

module.exports = discoverGeocaches;
