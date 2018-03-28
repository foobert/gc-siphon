const debug = require("debug")("gc:lookup:util");

function daysAgo(days) {
  let date = new Date();
  date.setTime(date.getTime() - 24 * 60 * 60 * 1000 * days);
  return date;
}

function distance(coord1, coord2) {
  const r = 6371000; // earth radius in meters
  const _toRad = x => x * Math.PI / 180;

  const phi1 = _toRad(coord1.lat);
  const phi2 = _toRad(coord2.lat);

  const deltaPhi = _toRad(coord2.lat - coord1.lat);
  const deltaLambda = _toRad(coord2.lon - coord1.lon);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = r * c;

  debug("distance %o -> %o = %d m", coord1, coord2, distance);
  return distance;
}

function width(bbox) {
  // this is technically wrong, because it's not a perfect rectangle
  // but for our scales it should be good enough
  return distance(
    {
      lat: bbox[0].lat,
      lon: bbox[0].lon
    },
    {
      lat: bbox[0].lat,
      lon: bbox[1].lon
    }
  );
}

function height(bbox) {
  // this is technically wrong, because it's not a perfect rectangle
  // but for our scales it should be good enough
  return distance(
    {
      lat: bbox[0].lat,
      lon: bbox[0].lon
    },
    {
      lat: bbox[1].lat,
      lon: bbox[0].lon
    }
  );
}

function area(bbox) {
  const topLeft = {
    lat: Math.max(bbox[0].lat, bbox[1].lat),
    lon: Math.min(bbox[0].lon, bbox[1].lon)
  };
  const bottomRight = {
    lat: Math.min(bbox[0].lat, bbox[1].lat),
    lon: Math.max(bbox[0].lon, bbox[1].lon)
  };
  const topRight = {
    lat: topLeft.lat,
    lon: bottomRight.lon
  };
  const bottomLeft = {
    lat: bottomRight.lat,
    lon: topLeft.lon
  };
  const width = distance(topLeft, topRight);
  const height = distance(topLeft, bottomLeft);
  return height * width;
}

module.exports = {
  daysAgo,
  distance,
  area,
  width,
  height
};
