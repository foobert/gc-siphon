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

async function discoverGeometry(geometry, bbox, collection) {
  // must at least zoom 12, because groundspeak drops
  // geocaches from the results otherwise
  let tiles = toTiles(geometry || bbox, 12);
  let count = 0;
  debug("Need to fetch %d tiles", tiles.length);
  for (let tile of tiles) {
    let now = new Date();
    let gcs = await fetchTile(tile);
    let bbox = toBoundingBox(tile);
    count += gcs.length;

    debug("Tile %o %d geocaches", tile, gcs.length);

    metrics({ discover: gcs.length, tile });

    // TODO updateMany?
    for (let gc of gcs) {
      await collection.update(
        { _id: gc },
        { $set: { gc, tile, bbox, discover_date: now } },
        { upsert: true }
      );
    }
  }
  return count;
}

async function discoverGeocaches({ areas, gcs }) {
  debug("Discovering Geocaches");
  const docs = await areas
    .find({
      $or: [
        { discover_date: { $exists: false } },
        { discover_date: { $lt: hoursAgo(23) } }
      ]
    })
    .sort("discover_date", 1)
    .toArray();

  for (let doc of docs) {
    debug("Discovering %s", doc.name);
    let count = await discoverGeometry(doc.geometry, doc.bbox, gcs);
    await areas.update(
      { _id: doc._id },
      { $set: { discover_date: new Date(), count } }
    );

    if (doc.bbox) {
      debug("Migrating area %s to GeoJSON geometry", doc._id);
      const geometry = migrateAreaToGeoJson(doc.bbox);
      assert(geometry, "new geometry must not be null");
      await areas.update(
        { _id: doc._id },
        {
          $set: {
            geometry
          },
          $unset: { bbox: "" }
        }
      );
    }
  }
}

function migrateAreaToGeoJson(geometry) {
  assert.equal(2, geometry.length);

  const bbox = [
    Math.min(geometry[0].lon, geometry[1].lon),
    Math.min(geometry[0].lat, geometry[1].lat),
    Math.max(geometry[0].lon, geometry[1].lon),
    Math.max(geometry[0].lat, geometry[1].lat)
  ];
  const feature = turf.bboxPolygon(bbox);

  return feature.geometry;
}

module.exports = discoverGeocaches;
