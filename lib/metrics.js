const debug = require("debug")("gc:siphon:metrics");
const elasticsearch = require("elasticsearch");
const fs = require("fs");

function loadFile(key) {
  const filename = process.env[key];
  if (filename) {
    return fs.readFileSync(filename);
  }
}

function createClient() {
  const url = process.env["GC_ELASTICSEARCH_URL"];
  if (!url) {
    debug("Missing GC_ELASTICSEARCH_URL in environment, won't publish metrics");
    return null;
  }

  const cert = loadFile("GC_ELASTICSEARCH_CERT");
  const key = loadFile("GC_ELASTICSEARCH_KEY");

  return elasticsearch.Client({
    host: url,
    ssl: {
      key,
      cert
    }
  });
}

async function publish(data) {
  if (!client) {
    return;
  }
  let entry = {
    timestamp: new Date(),
    applicationName: "gc-siphon"
  };
  Object.assign(entry, data);
  await client.index({
    index: "gc-metrics",
    type: "gc-siphon",
    body: entry
  });
}

async function main() {
  if (!client) {
    return;
  }
  debug("Elasticsearch: %o", await client.ping());

  const hasIndex = await client.indices.exists({
    index: "gc-metrics"
  });

  if (!hasIndex) {
    const res = await client.indices.create({
      index: "gc-metrics"
    });
    debug("Created index: %o", res);
  }
}

const client = createClient();
main().catch(console.log);
module.exports = publish;
