/* eslint-env mocha */
const { expect } = require("chai");

const constants = require("../lib/constants");
const { parse, PARSER_VERSION } = require("../lib/gcparser");

describe("geocache parser", () => {
  it("should handle premium geocaches", () => {
    const parsed = parse({ IsPremium: true });
    expect(parsed.premium).to.be.true;
  });

  it("should parse the name", () => {
    const parsed = parse({ Name: "foo" });
    expect(parsed.name).to.equal("foo");
  });

  it("should parse latitude and longitude", () => {
    const parsed = parse({ Latitude: 1, Longitude: 2 });
    expect(parsed.lat).to.equal(1);
    expect(parsed.lon).to.equal(2);
  });

  it("should parse difficulty", () => {
    const parsed = parse({ Difficulty: 3.5 });
    expect(parsed.difficulty).to.equal(3.5);
  });

  it("should parse terrain", () => {
    const parsed = parse({ Terrain: 3.5 });
    expect(parsed.terrain).to.equal(3.5);
  });

  describe("size", () => {
    const cases = [
      [1, constants.size.NOT_CHOSEN],
      [2, constants.size.MICRO],
      [3, constants.size.REGULAR],
      [4, constants.size.LARGE],
      [5, constants.size.VIRTUAL],
      [6, constants.size.OTHER],
      [8, constants.size.SMALL]
    ];
    for (let [input, output] of cases) {
      it(`should parse size ${input} into ${output}`, () => {
        const parsed = parse({ ContainerType: { ContainerTypeId: input } });
        expect(parsed.size).to.equal(output);
      });
    }

    it("should parse unknown size into null", () => {
      const parsed = parse({ ContainerType: { ContainerTypeId: 42 } });
      expect(parsed.size).to.be.null;
    });

    it("should parse missing size into null", () => {
      const parsed = parse({});
      expect(parsed.size).to.be.null;
    });
  });

  it("should parse the hint", () => {
    const parsed = parse({ EncodedHints: "foo bar baz" });
    expect(parsed.hint).to.equal("foo bar baz");
  });

  describe("type", () => {
    const cases = [
      [2, constants.type.TRADITIONAL],
      [3, constants.type.MULTI],
      [4, constants.type.VIRTUAL],
      [5, constants.type.LETTERBOX],
      [6, constants.type.EVENT],
      [8, constants.type.MYSTERY],
      [13, constants.type.CITO],
      [137, constants.type.EARTH],
      [1858, constants.type.WHERIGO]
    ];
    for (let [input, output] of cases) {
      it(`should parse type ${input} into ${output}`, () => {
        const parsed = parse({ CacheType: { GeocacheTypeId: input } });
        expect(parsed.type).to.equal(output);
      });
    }

    it("should parse unknown type into null", () => {
      const parsed = parse({ CacheType: { GeocacheTypeId: 42 } });
      expect(parsed.type).to.be.null;
    });

    it("should parse missing type into null", () => {
      const parsed = parse({});
      expect(parsed.type).to.be.null;
    });
  });

  describe("disabled flag", () => {
    it("should be false when Available and not Archived", () => {
      const parsed = parse({ Available: true, Archived: false });
      expect(parsed.disabled).to.be.false;
    });

    it("should be true when not Available", () => {
      const parsed = parse({ Available: false });
      expect(parsed.disabled).to.be.true;
    });

    it("should be true when Archived", () => {
      const parsed = parse({ Archived: true });
      expect(parsed.disabled).to.be.true;
    });
  });

  it("should default premium to false", () => {
    const parsed = parse({});
    expect(parsed.premium).to.be.false;
  });
});

describe("parser version", () => {
  it("should be a string", () => {
    expect(PARSER_VERSION).to.be.a("string");
  });
});
