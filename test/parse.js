/* eslint-env mocha */
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);

const process = require("../lib/parse");
const { parse, parseCoord, PARSER_VERSION } = require("../lib/gcparser");

describe.skip("parse", () => {
  let gcs = null;
  let nextBatch = sinon.stub();
  let api = null;

  beforeEach(async () => {
    const cursor = {
      toArray: nextBatch
    };
    gcs = {
      aggregate: sinon.stub().returns(cursor),
      bulkWrite: sinon.stub()
    };

    const now = new Date();
    api = {
      Latitude: 1,
      Longitude: 2
    };
    nextBatch.reset();
    nextBatch.onFirstCall().resolves([
      {
        _id: "GC0001",
        parsed_version: "something",
        api,
        api_date: now,
        parsed_date: now
      }
    ]);
    nextBatch.resolves([]);
  });

  it("should process documents", async () => {
    // since we're mocking the result of the mongodb aggregation pipeline
    // we can't really test that our pipeline would
    // select the correct documents, so that's not really tested here
    await process(gcs);

    expect(gcs.bulkWrite.calledOnce).to.be.true;
    const [updateOps, opts] = gcs.bulkWrite.getCall(0).args;
    // this is horrible, but I guess the only way to unit test this
    expect(updateOps).to.have.length(1);
    expect(updateOps[0].updateOne.filter._id).to.equal("GC0001");

    expect(opts.ordered).to.be.false;
  });

  it("should set parsed field", async () => {
    await process(gcs);

    const [updateOps] = gcs.bulkWrite.getCall(0).args;
    const setOps = updateOps[0].updateOne.update.$set;
    expect(setOps.parsed).to.deep.equal(parse(api));
    expect(setOps.parsed_version).to.equal(PARSER_VERSION);
  });

  it("should set parsed date", async () => {
    await process(gcs);

    const [updateOps] = gcs.bulkWrite.getCall(0).args;
    const setOps = updateOps[0].updateOne.update.$set;
    expect(new Date() - setOps.parsed_date).to.be.lessThan(5000);
  });

  it("should set coord field", async () => {
    await process(gcs);

    const [updateOps] = gcs.bulkWrite.getCall(0).args;
    const setOps = updateOps[0].updateOne.update.$set;
    expect(setOps.coord).to.deep.equal(parseCoord(api));
  });

  it("should set coord date", async () => {
    await process(gcs);

    const [updateOps] = gcs.bulkWrite.getCall(0).args;
    const setOps = updateOps[0].updateOne.update.$set;
    expect(new Date() - setOps.coord_date).to.be.lessThan(5000);
  });

  it("should keep existing fields", async () => {
    await process(gcs);

    const [updateOps] = gcs.bulkWrite.getCall(0).args;
    expect(updateOps[0].updateOne.upsert).to.be.true;
  });

  it("should skip up-to-date documents", async () => {
    // again this is basically bullshit mocking, but the best
    // we can get without actually doing integration tests against
    // mongodb
    nextBatch.reset();
    nextBatch.resolves([]);
    await process(gcs);
    expect(gcs.bulkWrite.called).to.be.false;
  });

  it("should handle errors", async () => {
    gcs.bulkWrite.rejects(new Error("boom"));
    await process(gcs);
  });

  it("should not be able to use mongo-mock", async () => {
    // mongo-mock is cool, but does not support aggregation framework at the
    // time of writing this. This test ensures that we get a failure when it
    // does so that we can rewrite the tests to use mongo-mock instead.
    const mongodb = require("mongo-mock");
    mongodb.max_delay = 0;
    const MongoClient = mongodb.MongoClient;
    const db = await MongoClient.connect(
      "mongodb://localhost:27017/unittest",
      {}
    );
    const collection = db.collection("foo");
    try {
      collection.aggregate();
      expect(1).to.be(2);
    } catch (err) {
      expect(err.message).to.equal("Not Implemented");
    }
    db.close();
  });
});
