const kafka = require("kafka-node");
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
  if (res.ok) {
    // TODO don't do this! instead do a stream and push the html back to kafka
    $ = cheerio.load(res.text);
    const name = $("#ctl00_ContentBody_CacheName").text();
    const hiddenRaw = $("#ctl00_ContentBody_mcd2").text();
    const difficultyRaw = $("#ctl00_ContentBody_diffTerr img").attr("alt");
    const difficulty = parseFloat(difficultyRaw.trim().split(" ")[0]);
    console.log(name, hiddenRaw, difficultyRaw, difficulty);
  }
}

const client = new kafka.KafkaClient({ kafkaHost: "localhost:9092" });
const consumer = new kafka.Consumer(client, [{ topic: "foo" }], {
  autoCommit: false,
  fromOffset: true
});

consumer.on("error", error);

const q = async.queue((msg, cb) => {
  //console.log(msg);
  process(msg, cb);
}, 1);

q.drain = () => {
  consumer.resume();
};

consumer.on("message", msg => {
  //console.log(msg);
  consumer.pause();
  q.push(msg);
});
