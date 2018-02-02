const cheerio = require("cheerio");
const debug = require("debug")("gc-lookup");

const update = require("./update");

function parseStars(selector) {
  const raw = $(selector)
    .children("img")
    .attr("alt");
  const value = parseFloat(raw.trim().split(" ")[0]);
  return value;
}

function rot13(text) {
  // thank you stack overflow!
  return text.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26
    );
  });
}

function calculateFoundScore(html) {
  const m = html.match(/^initalLogs = .+$/m);
  if (!m) {
    // err on the side of reporting the cache
    return 1;
  }

  const logs = m[0].match(/"LogType":"[a-zA-Z' ]+"/g);
  if (!logs || logs.length === 0) {
    // again, be safe about missing logs
    return 1;
  }
  const founds = logs.filter(l => l === '"LogType":"Found it"');
  const foundScore = founds.length / logs.length;
  return foundScore;
}

function parse(gc, html) {
  debug("Parse %s", gc);
  $ = cheerio.load(html);
  const premium = $(".pmo-banner");
  if (premium.length > 0) {
    return { premium: true };
  }

  const name = $("#ctl00_ContentBody_CacheName").text();
  const hiddenRaw = $("#ctl00_ContentBody_mcd2").text();
  const difficulty = parseStars("#ctl00_ContentBody_uxLegendScale");
  const terrain = parseStars("#ctl00_ContentBody_Localize12");
  let size = $("#ctl00_ContentBody_size small").text();
  size = size.substr(1, size.length - 2);
  const type = $(".cacheImage img").attr("title");
  const hint = rot13($("#div_hint").text());
  const disabled = $("#ctl00_ContentBody_disabledMessage").toArray().length > 0;
  const foundScore = calculateFoundScore(html);

  return {
    name,
    difficulty,
    terrain,
    size,
    hint,
    type,
    disabled,
    foundScore,
    premium: false
  };
}

async function process(collection) {
  debug("Parsing HTML");
  const fresh = false;
  // TODO do an aggregation and compare with html_date
  const query = fresh ? {} : { parsed: { $exists: false } };
  await update(collection, query, doc => {
    return {
      parsed: parse(doc.gc, doc.html),
      parsed_date: new Date()
    };
  });
}

module.exports = process;
