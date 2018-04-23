/* eslint-env mocha */
const { expect } = require("chai");
const sinon = require("sinon");
const _ = require("lodash");
const mongodb = require("mongo-mock");
const mock = require("mock-require");
const request = {};
mock("superagent", request);

const loginMock = {
  login: sinon.stub().resolves("secret-access-token"),
  canLogin: sinon.stub().returns(true)
};

mock("../lib/login", loginMock);

const apifetch = require("../lib/apifetch");
const { daysAgo } = require("../lib/util");

describe("apifetch", () => {
  let db = null;
  let gcs = null;

  before(async () => {
    mongodb.max_delay = 1;
    const MongoClient = mongodb.MongoClient;
    db = await MongoClient.connect("mongodb://localhost:27017/unittest", {});

    gcs = db.collection("gcs");
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

    await gcs.deleteMany({});
    loginMock.login.resetHistory();
    loginMock.canLogin.resetHistory();
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
        api: { old: true },
        api_date: daysAgo(7)
      }
    ]);

    await apifetch(gcs);

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

    await apifetch(gcs);

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

    await apifetch(gcs);

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

    await apifetch(gcs);

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

    await apifetch(gcs);

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

    await apifetch(gcs);

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
    await apifetch(gcs);

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
    await apifetch(gcs);

    expect(request.send.callCount).to.equal(2);
    expect(request.send.getCall(0).args[0].CacheCode.CacheCodes).to.have.length(
      50
    );
    expect(request.send.getCall(1).args[0].CacheCode.CacheCodes).to.have.length(
      10
    );
  });
});
