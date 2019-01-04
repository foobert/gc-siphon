const debug = require("debug")("gc:siphon:signux");
const mysql = require("mysql");

function processSignux({ gcs }) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection(
      process.env["GC_G2_URI"] || "mysql://localhost/G2"
    );

    connection.connect();

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const query = connection.query(
      "SELECT WP, Api, ApiUpdateTime FROM WP WHERE ApiUpdateTime >= ?",
      yesterday
    );

    query.on("error", err => {
      debug("Error %o", err);
      connection.end();
      reject(err);
    });

    query.on("result", row => {
      connection.pause();

      gcs.findOne({ _id: row.WP }, { api_date: 1 }).then(fdoc => {
        if (fdoc !== null && fdoc.api_date >= row.ApiUpdateTime) {
          //debug(
          //"Skip update %s (%o vs. %o)",
          //row.WP,
          //fdoc.api_date,
          //row.ApiUpdateTime
          //);
          connection.resume();
        } else {
          debug("Update %s", row.WP);
          const doc = {
            _id: row.WP,
            api: JSON.parse(row.Api),
            api_date: row.ApiUpdateTime
          };
          gcs
            .update({ _id: doc._id }, { $set: doc }, { upsert: true })
            .then(() => {
              connection.resume();
            })
            .catch(err => {
              connection.end();
              reject(err);
            });
        }
      });
    });

    query.on("end", () => {
      debug("Done");
      connection.end();
      resolve();
    });
  });
}

module.exports = processSignux;
