/* eslint-env mocha */
const { expect } = require("chai");
const { ageLabel, daysAgo } = require("../lib/util");

describe("ageLabel", () => {
  it("should tell the age", () => {
    // this could be way more exhaustive, but we trust that we're using moment
    // so it should be fine
    const now = new Date();
    const before = new Date(now - 3600000);
    const label = ageLabel(before);
    expect(label).to.equal("an hour ago");
  });

  it("should handle null", () => {
    const label = ageLabel(null);
    expect(label).to.equal("never");
  });

  it("should handle undefined", () => {
    const label = ageLabel(undefined);
    expect(label).to.equal("never");
  });
});

describe("daysAgo", () => {
  it("should return a date object", () => {
    expect(daysAgo(1)).to.be.a("Date");
  });

  it("should be n days ago", () => {
    const now = new Date();
    const yesterday = daysAgo(1);
    const msecPerDay = 86400000;
    expect(now - yesterday).to.be.within(msecPerDay - 1000, msecPerDay + 1000);
  });
});
