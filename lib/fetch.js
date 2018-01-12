const debug = require("debug")("gc-lookup");
const request = require("superagent");

const update = require("./update");
const { daysAgo } = require("./util");

async function fetch(gc) {
  debug("Fetch %s", gc);
  const res = await request.get(`https://www.geocaching.com/geocache/${gc}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${gc}: Status ${res.status}`);
  }
  return res.text;
}

async function process(collection) {
  debug("Updating HTML");
  const fresh = false;
  const query = fresh
    ? {}
    : {
        $or: [{ html: { $exists: false } }, { html_date: { $lt: daysAgo(30) } }]
      };
  await update(
    collection,
    query,
    async doc => {
      return {
        html: await fetch(doc.gc),
        html_date: new Date()
      };
    },
    5
  );
}

module.exports = process;
