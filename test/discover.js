/* eslint-env mocha */
const { expect } = require("chai");
const sinon = require("sinon");
const moment = require("moment");
const mongodb = require("mongo-mock");
const discover = require("../lib/discover");

describe("discover", () => {
  let areas = null;
  let gcs = null;
  let request = {};
  let tiles = null;

  before(async () => {
    request.get = sinon.stub().returns(request);
    request.accept = sinon.stub().returns(request);
    request.query = ({ x, y, z }) => {
      return {
        ok: true,
        body: {
          data: getTile({ x, y, z })
        }
      };
    };

    mongodb.max_delay = 1;
    const MongoClient = mongodb.MongoClient;
    const db = await MongoClient.connect(
      "mongodb://localhost:27017/unittest",
      {}
    );

    areas = db.collection("areas");
    gcs = db.collection("gcs");
  });

  beforeEach(async () => {
    await areas.deleteMany({});
    await gcs.deleteMany({});
    tiles = {};
  });

  const setTile = ({ x, y, z }, v) => {
    tiles[JSON.stringify({ x, y, z })] = v;
  };

  const getTile = ({ x, y, z }) => {
    return tiles[JSON.stringify({ x, y, z })] || {};
  };

  after(() => {});

  it("should update discover date on undiscovered areas", async () => {
    await areas.insertMany([
      { name: "area 1", bbox: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }] },
      { name: "area 2", bbox: [{ lat: 10, lon: 10 }, { lat: 11, lon: 11 }] }
    ]);

    await discover({ request: request, areas: areas, gcs });

    const docs = await areas.find({}).toArray();
    for (let doc of docs) {
      expect(doc.discover_date).to.exist;
    }
  });

  it("should update discover date on old areas", async () => {
    await areas.insertMany([
      {
        name: "area 1",
        bbox: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }],
        discover_date: moment()
          .subtract(25, "hours")
          .toDate()
      },
      {
        name: "area 2",
        bbox: [{ lat: 10, lon: 10 }, { lat: 11, lon: 11 }],
        discover_date: moment()
          .subtract(24, "hours")
          .toDate()
      }
    ]);

    await discover({ request: request, areas: areas, gcs });

    const docs = await areas.find({}).toArray();
    for (let doc of docs) {
      expect(doc.discover_date).to.exist;
    }
  });

  it("should skip recently updated areas", async () => {
    await areas.insertMany([
      {
        name: "area 1",
        bbox: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }],
        discover_date: moment()
          .subtract(23, "hours")
          .toDate()
      }
    ]);

    const { discover_date: before_date } = await areas.findOne(
      {},
      { discover_date: 1 }
    );

    await discover({ request: request, areas: areas, gcs });

    const { discover_date: after_date } = await areas.findOne(
      {},
      { discover_date: 1 }
    );
    expect(before_date.toISOString()).to.equal(after_date.toISOString());
  });

  it("should use zoom level 12", async () => {
    await areas.insertMany([
      {
        name: "area 1",
        bbox: [{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0.1 }]
      }
    ]);

    // return something for zoom level 12, but nothing else
    setTile({ x: 2048, y: 2046, z: 12 }, { "(0,0)": [{ i: "GC0001" }] });

    await discover({ request: request, areas: areas, gcs });

    const count = await gcs.count({});
    expect(count).to.be.at.least(1);
  });

  it("should merge gcs from multiple tiles", async () => {
    // x: 2048 -> 2049
    // y: 2046 -> 2048
    await areas.insertMany([
      {
        name: "area 1",
        bbox: [{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0.1 }]
      }
    ]);
    setTile({ x: 2048, y: 2046, z: 12 }, { "(0,0)": [{ i: "GC0001" }] });
    setTile(
      { x: 2049, y: 2046, z: 12 },
      {
        "(0,0)": [{ i: "GC0001" }, { i: "GC0002" }]
      }
    );
    await discover({ request: request, areas: areas, gcs });
    const count = await gcs.count({});
    expect(count).to.equal(2);
  });

  it("should update gc data", async () => {
    // this one should be upserted
    await gcs.insert({ _id: "GC0003", foo: "bar", discover_date: "boom!" });
    // x: 2048 -> 2049
    // y: 2046 -> 2048
    await areas.insertMany([
      {
        name: "area 1",
        bbox: [{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0.1 }]
      }
    ]);
    setTile({ x: 2048, y: 2046, z: 12 }, { "(0,0)": [{ i: "GC0001" }] });
    setTile(
      { x: 2049, y: 2046, z: 12 },
      {
        "(0,0)": [{ i: "GC0002" }, { i: "GC0003" }]
      }
    );

    const now = new Date();
    await discover({ request: request, areas: areas, gcs });

    const gc1 = await gcs.find({ _id: "GC0001" }).next();
    const gc2 = await gcs.find({ _id: "GC0002" }).next();
    const gc3 = await gcs.find({ _id: "GC0003" }).next();

    expect(gc1).to.exist;
    expect(gc1.gc).to.equal("GC0001");
    expect(gc1.tile).to.deep.equal({ x: 2048, y: 2046, z: 12 });
    expect(gc1.bbox).to.exist;
    expect(gc1.discover_date - now).to.be.below(5000);

    expect(gc2).to.exist;
    expect(gc2.gc).to.equal("GC0002");
    expect(gc2.tile).to.deep.equal({ x: 2049, y: 2046, z: 12 });
    expect(gc2.bbox).to.exist;
    expect(gc2.discover_date - now).to.be.below(5000);

    expect(gc3).to.exist;
    expect(gc3.gc).to.equal("GC0003");
    expect(gc3.tile).to.deep.equal({ x: 2049, y: 2046, z: 12 });
    expect(gc3.bbox).to.exist;
    expect(gc3.discover_date - now).to.be.below(5000);
  });

  it("should query the correct Groundspeak endpoint", async () => {
    await areas.insertMany([
      {
        name: "area 1",
        bbox: [{ lat: 0, lon: 0 }, { lat: 0.1, lon: 0.1 }]
      }
    ]);
    await discover({ request: request, areas: areas, gcs });
    expect(
      request.get.calledWithMatch(/https:\/\/tiles0[1234]\.geocaching\.com\//)
    ).to.be.true;
    expect(request.accept.calledWith("json")).to.be.true;
  });
});
