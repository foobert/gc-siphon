const debug = require("debug")("gc:siphon:metrics");
const metrics = require("datadog-metrics");

const apiKey = process.env["DATADOG_API_KEY"];
if (apiKey) {
  metrics.init({ host: "copper", prefix: "gc.siphon." });
} else {
  debug("Missing DATADOG_API_KEY in environment, won't publish metrics");
}

function increment(name, amount, tags) {
  if (apiKey) {
    metrics.increment(name, amount || 1, tags);
  }
}

function gauge(name, value, tags) {
  if (apiKey) {
    metrics.gauge(name, value, tags);
  }
}

module.exports = { increment, gauge };
