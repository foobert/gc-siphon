const async = require("async");
const request = require("superagent");
const cheerio = require("cheerio");

function error(err) {
  if (err) {
    console.log(err);
  }
}

function process(msg, cb) {
  let gc = null;
  try {
    const data = JSON.parse(msg.value);
    gc = data.gc;
  } catch (err) {}

  if (gc) {
    lookup(gc).then(cb);
  } else {
    cb();
  }
}

async function lookup(gc) {
  console.log("fetch", gc);
  const res = await request.get(`https://www.geocaching.com/geocache/${gc}`);
  console.log(res.status);
  if (res.ok) {
    return res.text;
  } else {
    throw new Error("unable to fetch");
    // TODO don't do this! instead do a stream and push the html back to kafka
    //$ = cheerio.load(res.text);
    //const name = $("#ctl00_ContentBody_CacheName").text();
    //const hiddenRaw = $("#ctl00_ContentBody_mcd2").text();
    //const difficultyRaw = $("#ctl00_ContentBody_diffTerr img").attr("alt");
    //const difficulty = parseFloat(difficultyRaw.trim().split(" ")[0]);
    //console.log(name, hiddenRaw, difficultyRaw, difficulty);
  }
}

async function connect() {
  const MongoClient = require("mongodb").MongoClient;
  const url = "mongodb://localhost:27017";
  const client = await MongoClient.connect(url);
  return client;
}

async function todoLookup(collection) {
  // TODO $or html_date too old
  const todo = await collection.find({ html: { $exists: false } });
  while (await todo.hasNext()) {
    let doc = await todo.next();
    const gc = doc.gc;
    console.log("todo", gc);
    const now = new Date();
    const html = await lookup(gc);
    await collection.update(
      { _id: gc },
      { $set: { html, html_date: now } },
      { upsert: true }
    );
  }
}

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

function parse(gc, html) {
  $ = cheerio.load(html);
  try {
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
    const hint = rot13($("#div_hint").text());
    return {
      name,
      difficulty,
      terrain,
      size,
      hint,
      premium: false
    };
  } catch (err) {
    console.log("Parsing failed", gc, err);
    return null;
  }
}

async function todoParse(collection) {
  //const todo = await collection.find({ parsed: { $exists: false } });
  const todo = await collection.find();
  while (await todo.hasNext()) {
    let doc = await todo.next();
    const gc = doc.gc;
    const now = new Date();
    const parsed = parse(gc, doc.html);
    await collection.update(
      { _id: gc },
      { $set: { parsed, parsed_date: now } },
      { upsert: true }
    );
  }
}

async function main() {
  const client = await connect();
  const db = client.db("gc");
  const collection = db.collection("gcs");

  await todoLookup(collection);
  await todoParse(collection);

  await client.close();
}

main();
