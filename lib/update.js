const debug = require("debug")("gc:lookup:update");

async function update(collection, query, mapper) {
  // query small batches to prevent cursor time-outs on long running updates
  // update: limit and loop sounds nice but doesn't work together with "fresh" mode
  const docs = await collection.find(query).toArray();
  if (docs.length === 0) {
    debug("Nothing needs updating");
    return;
  }
  debug("Need to update %d documents", docs.length);
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

module.exports = update;
