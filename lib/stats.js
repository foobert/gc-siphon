const metrics = require("./metrics");
const { daysAgo } = require("./util");

async function count(gcs, name, query, tags) {
  const value = await gcs.count(query);
  metrics.gauge(name, value, tags);
}

async function process({ gcs }) {
  await count(gcs, "stats.api", { api: { $exists: true } }, ["source:any"]);
  await count(
    gcs,
    "stats.api",
    { api: { $exists: true }, api_source: "groundspeak" },
    ["source:groundspeak"]
  );
  await count(gcs, "stats.api", { api: { $exists: true }, api_source: "g2" }, [
    "source:g2"
  ]);
  await count(gcs, "stats.docs", {});
  await count(gcs, "stats.parsed", { parsed: { $exists: true } }, ["age:any"]);
  await count(
    gcs,
    "stats.parsed",
    { parsed: { $exists: true }, parsed_date: { $gte: daysAgo(7) } },
    ["age:7d"]
  );
}

module.exports = process;
