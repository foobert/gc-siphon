const _ = require("lodash");
const debug = require("debug")("gc:lookup:discover");
const moment = require("moment");

const { daysAgo, area, width, height } = require("./util");
const { toBoundingBox, toTiles } = require("./tiles");

async function fetchTile(request, tile) {
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

async function report({ areas, gcs }) {
  const docs = await areas
    .find({})
    .sort("name", 1)
    .toArray();
  console.log("Areas:");
  for (const doc of docs) {
    const w = Math.round(width(doc.bbox) / 1000);
    const h = Math.round(height(doc.bbox) / 1000);
    const gcCount = await gcs.count({
      coord: {
        $geoWithin: {
          $geometry: {
            type: "Polygon",
            coordinates: [
              [
                [doc.bbox[0].lon, doc.bbox[0].lat],
                [doc.bbox[1].lon, doc.bbox[0].lat],
                [doc.bbox[1].lon, doc.bbox[1].lat],
                [doc.bbox[0].lon, doc.bbox[1].lat],
                [doc.bbox[0].lon, doc.bbox[0].lat]
              ]
            ]
          }
        }
      }
    });
    const lastUpdate = doc.discover_date
      ? moment(doc.discover_date).fromNow()
      : "never";
    console.log(
      "- %s, %dx%d km containing %d geocaches, updated %s",
      doc.name,
      w,
      h,
      gcCount,
      lastUpdate
    );
  }
}

async function discoverBoundingBox(request, bbox, collection) {
  let tiles = toTiles(bbox[0], bbox[1]);
  for (let tile of tiles) {
    let now = new Date();
    let gcs = await fetchTile(request, tile);
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

async function discoverGeocaches({ request, areas, gcs }) {
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
    await discoverBoundingBox(request, doc.bbox, gcs);
    areas.update({ _id: doc._id }, { $set: { discover_date: new Date() } });
  }

  await report({ areas, gcs });
}

module.exports = discoverGeocaches;
