const async = require("async");
const debug = require("debug")("gc-lookup");

async function updateFancy(collection, query, mapper, concurrency = 1) {
  const q = async.queue(async (doc, done) => {
    if (doc == null) {
      done();
      return;
    }
    try {
      let update = await Promise.resolve(mapper(doc));
      await collection.update(
        { _id: doc._id },
        { $set: update },
        { upsert: true }
      );
    } catch (err) {
      debug("Error while updating %s", doc._id);
    }
  }, 5);

  const cursor = await collection.find(query);
  while (await cursor.hasNext()) {
    let doc = await cursor.next();
    await q.push(doc);
  }

  await new Promise((resolve, reject) => {
    q.push(null, resolve);
  });
}

async function update(collection, query, mapper) {
  while (true) {
    // query small batches to prevent cursor time-outs on long running updates
    const docs = await collection
      .find(query)
      .limit(100)
      .toArray();
    if (docs.length === 0) {
      return;
    }
    for (let doc of docs) {
      try {
        let update = await Promise.resolve(mapper(doc));
        await collection.update(
          { _id: doc._id },
          { $set: update },
          { upsert: true }
        );
      } catch (err) {
        debug("Error while updating %s: %s", doc._id, err.message);
      }
    }
  }
}

module.exports = update;
