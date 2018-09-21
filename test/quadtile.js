/* eslint-env mocha */

const { expect } = require("chai");
const { toTile, toQuadKey } = require("../lib/quadtile");

describe("toTile", () => {
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

describe("toQuadKey", () => {});
