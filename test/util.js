/* eslint-env mocha */
const { expect } = require("chai");
const { daysAgo } = require("../lib/util");

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
