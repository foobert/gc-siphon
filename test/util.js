/* eslint-env mocha */
const { expect } = require("chai");
const { ageLabel, daysAgo, hoursAgo } = require("../lib/util");

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

  it("should honor the specified 'now' value", () => {
    const now = new Date("2000-01-02");
    const yesterday = daysAgo(1, now);
    const msecPerDay = 86400000;
    expect(now - yesterday).to.be.within(msecPerDay - 1000, msecPerDay + 1000);
  });
});

describe("hoursAgo", () => {
  it("should return a date object", () => {
    expect(hoursAgo(24)).to.be.a("Date");
  });

  it("should be n hours ago", () => {
    const now = new Date();
    const anHourAgo = hoursAgo(1);
    const msecPerHour = 3600000;
    expect(now - anHourAgo).to.be.within(
      msecPerHour - 1000,
      msecPerHour + 1000
    );
  });

  it("should honor a specifc 'now' value", () => {
    const now = new Date("1999-01-02");
    const anHourAgo = hoursAgo(1, now);
    const msecPerHour = 3600000;
    expect(now - anHourAgo).to.be.within(
      msecPerHour - 1000,
      msecPerHour + 1000
    );
  });
});
