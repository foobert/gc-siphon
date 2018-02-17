/* eslint-env mocha */
const { expect } = require("chai");
const sinon = require("sinon");
const discover = require("../lib/discover");

function mongoFind(result) {
  const cursor = {};
  cursor.sort = sinon.stub().returns(cursor);
  cursor.toArray = sinon.stub().resolves(result);
  return sinon.stub().returns(cursor);
}

describe("discover", () => {
  it("should process all areas", async () => {
    const docs = [
      { name: "area 1", bbox: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }] },
      { name: "area 2", bbox: [{ lat: 10, lon: 10 }, { lat: 11, lon: 11 }] }
    ];

    const areas = {
      find: mongoFind(docs),
      update: sinon.spy()
    };

    const gcs = {};

    const tile = {
      ok: true,
      body: { data: [] }
    };

    const request = {};
    request.get = sinon.stub().returns(request);
    request.accept = sinon.stub().returns(request);
    request.query = sinon.stub().resolves(tile);

    await discover({ request: request, areas: areas, gcs });

    for (let doc of docs) {
      expect(areas.update.calledWith({ _id: doc._id })).to.be.true;
    }
  });
});
