/* eslint-env mocha */
const { expect } = require("chai");
const sinon = require("sinon");
const _ = require("lodash");
const mongodb = require("mongo-mock");
const turf = require("@turf/turf");
const mock = require("mock-require");
const request = {};
mock("superagent", request);
const MockDate = require("mockdate");

const loginMock = {
  login: sinon.stub(),
  canLogin: sinon.stub()
};

mock("../lib/login", loginMock);

const apifetch = require("../lib/apifetch");
const { daysAgo } = require("../lib/util");

describe("apifetch", () => {
  let db = null;
  let gcs = null;
  let areas = null;

  before(async () => {
    mongodb.max_delay = 1;
    const MongoClient = mongodb.MongoClient;
    db = await MongoClient.connect("mongodb://localhost:27017/unittest", {});

    gcs = db.collection("gcs");
    areas = db.collection("areas");
  });

  beforeEach(async () => {
    request.get = sinon.stub().returns(request);
    request.accept = sinon.stub().returns(request);
    request.post = sinon.stub().returns(request);
    request.query = sinon.stub().returns(request);
    request.send = sinon.stub().resolves({
      status: 200,
      body: {
        Geocaches: [
          {
            Code: "GC0001",
            Key: "Value"
          }
        ]
      }
    });
    loginMock.login.resolves("secret-access-token");
    loginMock.canLogin.returns(true);
    loginMock.login.resetHistory();
    loginMock.canLogin.resetHistory();
    request.send.resetHistory();

    await gcs.deleteMany({});
    await areas.deleteMany({});
  });

  after(() => {
    db.close();
    mock.stop("superagent");
  });

  it("should process old documents", async () => {
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001",
        api: { old: true, Archived: false },
        api_date: daysAgo(7)
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(new Date() - doc.api_date).to.be.lessThan(5000);
  });

  it("should process archived documents after 90 days", async () => {
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001",
        api: { old: true, Archived: true },
        api_date: daysAgo(90)
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(new Date() - doc.api_date).to.be.lessThan(5000);
  });

  it("should skip recently updated documents", async () => {
    const newDate = daysAgo(6);
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001",
        api: { some: "data" },
        api_date: newDate
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(doc.api_date.toISOString()).to.equal(newDate.toISOString());
  });

  it("should skip recently updated archived documents", async () => {
    const newDate = daysAgo(89);
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001",
        api: { some: "data", Archived: true },
        api_date: newDate
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(doc.api_date.toISOString()).to.equal(newDate.toISOString());
  });

  it("should skip recently updated premium documents", async () => {
    const newDate = daysAgo(89);
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001",
        api: { some: "data", Archived: false, IsPremium: true },
        api_date: newDate
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(doc.api_date.toISOString()).to.equal(newDate.toISOString());
  });

  it("should process new documents", async () => {
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001"
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(new Date() - doc.api_date).to.be.lessThan(5000);
  });

  it("should store api data", async () => {
    const apiData = {
      Code: "GC0001",
      Key: "Value",
      Test: "Data"
    };
    request.send = sinon.stub().resolves({
      status: 200,
      body: {
        Geocaches: [apiData]
      }
    });

    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001"
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(doc.api).to.deep.equal(apiData);
  });

  it("should keep existing data", async () => {
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001",
        old: "data"
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(doc.old).to.equal("data");
  });

  it("should login exactly once", async () => {
    await gcs.insertMany(
      _.range(51).map(i => ({
        _id: "GC00" + i,
        gc: "GC00" + i
      }))
    );

    await apifetch({ gcs, areas });

    expect(loginMock.login.calledOnce).to.be.true;
  });

  it("should not exceed the daily limit", async () => {
    const now = new Date();

    await gcs.insertMany(
      _.range(1990).map(i => ({
        _id: "GC00" + i,
        gc: "GC00" + i,
        api_date: now,
        api: {}
      }))
    );

    await gcs.insertMany(
      _.range(20).map(i => ({
        _id: "GC10" + i,
        gc: "GC10" + i
      }))
    );

    // have 20 todo, but should only fetch 10
    await apifetch({ gcs, areas });

    expect(request.send.calledOnce).to.be.true;
  });

  it("should not exceed the daily limit (two batches)", async () => {
    const now = new Date();

    await gcs.insertMany(
      _.range(1940).map(i => ({
        _id: "GC00" + i,
        gc: "GC00" + i,
        api_date: now,
        api: {}
      }))
    );

    await gcs.insertMany(
      _.range(80).map(i => ({
        _id: "GC10" + i,
        gc: "GC10" + i
      }))
    );

    // have 80 todo, but should only fetch 60
    await apifetch({ gcs, areas });

    expect(request.send.callCount).to.equal(2);
    expect(request.send.getCall(0).args[0].CacheCode.CacheCodes).to.have.length(
      50
    );
    expect(request.send.getCall(1).args[0].CacheCode.CacheCodes).to.have.length(
      10
    );
  });

  it("should do nothing when env is not set", async () => {
    loginMock.canLogin.returns(false);
    await gcs.insertMany([
      {
        _id: "GC0001",
        gc: "GC0001"
      }
    ]);

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({});
    expect(doc.api_date).to.not.exist;
  });

  it("should handle errors", async () => {
    await gcs.insertMany(
      _.range(51).map(i => ({
        _id: "GC00" + i,
        gc: "GC00" + i
      }))
    );
    request.send = sinon.stub().throws(new Error("boom"));

    await apifetch({ gcs, areas });

    expect(await gcs.count({ api_date: { $exists: true } })).to.equal(0);
    expect(request.send.callCount).to.equal(1);
  });

  // $geoWithin isn't supported by mongomock, need to migrate away
  it.skip("should process documents from areas first", async () => {
    await areas.insert({
      name: "test",
      geometry: turf.bboxPolygon([0, 0, 5, 5]).geometry
    });
    await gcs.insertMany(
      _.range(60).map(i => ({
        _id: "GC00" + i,
        gc: "GC00" + i,
        coord: { type: "Point", coordinates: [1, 1] }
      }))
    );

    await gcs.insertMany(
      _.range(60).map(i => ({
        _id: "GC10" + i,
        gc: "GC10" + i,
        coord: { type: "Point", coordinates: [11, 11] }
      }))
    );

    await apifetch({ gcs, areas });
  });

  it("should use a single timestamp during fetch", async () => {
    const now = new Date();
    const old1 = daysAgo(7, now);
    const old2 = daysAgo(7, now);
    old2.setDate(old2.getDate() - 1);
    const now2 = new Date();
    now2.setDate(now.getDate() + 1);

    MockDate.set(now);

    await gcs.insertMany(
      _.range(50).map(i => ({
        _id: "GC00" + i,
        api: { some: "data" },
        api_date: old2
      }))
    );

    await gcs.insertMany([
      { _id: "GC2", api: { some: "data" }, api_date: old1 }
    ]);

    request.send = async () => {
      MockDate.set(now2);
      return {
        status: 200,
        body: {
          Geocaches: [
            {
              Code: "GC0001",
              Key: "Value"
            }
          ]
        }
      };
    };

    await apifetch({ gcs, areas });

    const doc = await gcs.findOne({ _id: "GC2" });
    expect(doc.api_date.toISOString()).to.equal(old1.toISOString());
  });
});
