/* eslint-env mocha */
const { expect } = require("chai");
const {
  toTile,
  toTiles,
  toBoundingBox,
  toCoordinates
} = require("../lib/tiles");

describe("toTile", () => {
  it("should use a fixed zoom level", () => {
    let { z } = toTile(0, 0);
    expect(z).to.equal(11);
  });

  it("should translate coordinates to a tile", () => {
    let { x, y } = toTile(0, 0);
    expect(x).to.equal(1024);
    expect(y).to.equal(1024);
  });
});

describe("toTiles", () => {
  it("should return a list of tiles", () => {
    let tiles = toTiles({ lat: 0, lon: 0 }, { lat: 0.1, lon: 0.1 });
    expect(tiles).to.deep.equal([
      { x: 1024, y: 1023, z: 11 },
      { x: 1024, y: 1024, z: 11 }
    ]);
  });

  it("should sort tiles", () => {
    let tiles1 = toTiles({ lat: 10, lon: 1 }, { lat: 11, lon: -1 });
    let tiles2 = toTiles({ lat: 11, lon: -1 }, { lat: 10, lon: 1 });
    expect(tiles1).to.deep.equal(tiles2);
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
        let tile = toTile(lat, lon);
        let { lat: lat2, lon: lon2 } = toCoordinates(tile);
        expect(lat2).to.be.closeTo(lat, 0.2);
        expect(lon2).to.be.closeTo(lon, 0.2);
      }
    }
  });
});
