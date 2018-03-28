const assert = require("assert");

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

  assert.equal(tileA.z, tileB.z, "Zoom level must match");

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

module.exports = {
  toTile,
  toTiles,
  toCoordinates,
  toBoundingBox
};
