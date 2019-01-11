const turf = require("@turf/turf");

function makeGeometry(latA, lonA, latB, lonB) {
  const bbox = [
    Math.min(lonA, lonB),
    Math.min(latA, latB),
    Math.max(lonA, lonB),
    Math.max(latA, latB)
  ];
  const feature = turf.bboxPolygon(bbox);

  return feature.geometry;
}

const [arg0, arg1, name, latA, lonA, latB, lonB] = process.argv;

const area = {
  name: name,
  geometry: makeGeometry(
    parseFloat(latA),
    parseFloat(lonA),
    parseFloat(latB),
    parseFloat(lonB)
  )
};

console.log(JSON.stringify(area));
