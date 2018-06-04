/* eslint-env mocha */
const { expect } = require("chai");
const turf = require("@turf/turf");
const {
  toTile,
  toTiles,
  toBoundingBox,
  toCoordinates
} = require("../lib/tiles");

describe("toTile", () => {
  it("should use a configurable zoom level", () => {
    let { z } = toTile(0, 0, 11);
    expect(z).to.equal(11);
  });

  it("should translate coordinates to a tile", () => {
    let { x, y } = toTile(0, 0, 11);
    expect(x).to.equal(1024);
    expect(y).to.equal(1024);
  });

  it("should translate coordinates to a tile", () => {
    let { x, y } = toTile(52.512612, 13.387648, 12);
    expect(x).to.equal(2200);
    expect(y).to.equal(1343);
  });
});

describe("toTiles", () => {
  it("should return a list of tiles", () => {
    let { geometry } = turf.bboxPolygon([0, 0, 0.1, 0.1]);
    let tiles = toTiles(geometry, 11);
    expect(tiles).to.deep.equal([
      { x: 1024, y: 1023, z: 11 },
      { x: 1024, y: 1024, z: 11 }
    ]);
  });

  it("should work with real-life data", () => {
    let geometry = {
      type: "Polygon",
      coordinates: [
        [
          [11.404412, 48.065974],
          [11.733163, 48.065974],
          [11.733163, 48.275886],
          [11.404412, 48.275886],
          [11.404412, 48.065974]
        ]
      ]
    };
    let tiles = toTiles(geometry, 12);
    let expected = [];
    for (let x = 2177; x <= 2181; x++) {
      for (let y = 1419; y <= 1422; y++) {
        expected.push({ x, y, z: 12 });
      }
    }
    expect(tiles).to.deep.equal(expected);
  });
});

describe("toBoundingBox", () => {
  it("should first return the top left coordinate (and then bottom right)", () => {
    let bbox = toBoundingBox({ x: 0, y: 0, z: 11 });
    let [topLeft, bottomRight] = bbox;
    expect(topLeft.lat).to.be.greaterThan(bottomRight.lat);
    expect(topLeft.lon).to.be.lessThan(bottomRight.lon);
  });
});

describe("toCoordinates", () => {
  it("should translate a tile to coordinates", () => {
    let coord = toCoordinates({ x: 1024, y: 1024, z: 11 });
    expect(coord.lat).to.equal(0);
    expect(coord.lon).to.equal(0);
  });

  it("should reverse toTile", () => {
    for (let lat of [-10, 0, 10]) {
      for (let lon of [-10, 0, 10]) {
        let tile = toTile(lat, lon, 11);
        let { lat: lat2, lon: lon2 } = toCoordinates(tile);
        expect(lat2).to.be.closeTo(lat, 0.2);
        expect(lon2).to.be.closeTo(lon, 0.2);
      }
    }
  });
});
