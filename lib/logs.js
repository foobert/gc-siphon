const debug = require("debug")("gc:siphon:logs");
const request = require("superagent");

const { hoursAgo } = require("./util");
const { login, canLogin } = require("./login");

const MAX_LOGS = 30;

function delay(msec) {
  return new Promise(accept => setTimeout(accept, msec));
}

async function fetchLogs(user, users, gcs, accessToken) {
  const username = user._id;
  const latestLog = user.latestLog;
  debug(
    "Fetch %s's logs using %s, will stop at %s",
    username,
    accessToken,
    latestLog
  );

  let logs = [];
  for (;;) {
    const res = await request
      .post(
        "https://api.groundspeak.com/LiveV6/Geocaching.svc/GetUsersGeocacheLogs"
      )
      .accept("json")
      .query({ format: "json" })
      .send({
        AccessToken: accessToken,
        Username: username,
        MaxPerPage: MAX_LOGS,
        LogTypes: [2],
        StartIndex: logs.length
      });
    if (res.status != 200 || res.body.Status.StatusCode !== 0) {
      debug("Log fetch failed: %d, %o", res.status, res.body.Status);
      throw new Error("Error fetching logs: " + res.status);
    }

    const newLogs = res.body.Logs;
    logs = logs.concat(newLogs);

    debug("Logs: %d", logs.length);

    if (res.body.Logs.length < MAX_LOGS) {
      debug("No more logs to fetch");
      break;
    }

    if (newLogs.find(l => l.Code === latestLog)) {
      debug("Found existing log %s, skipping rest", latestLog);
      break;
    }

    // sleep a bit, so Groundspeak won't be mad at us
    await delay(2000);
  }

  const newLatestLog = logs.length > 0 ? logs[0].Code : undefined;
  debug("Set latest log to %s", newLatestLog);
  await users.update(
    { _id: user._id },
    { $set: { latestLog: newLatestLog } },
    { upsert: true }
  );
  return logs;
}

async function mergeLogs(username, gcs, logs) {
  debug("Merge %d logs of %s", logs.length, username);
  for (const log of logs) {
    await gcs.update(
      { _id: log.CacheCode },
      {
        $addToSet: { logs: log.Code, foundBy: username },
        $set: { logs_date: new Date() }
      },
      { upsert: true }
    );
  }
}

async function processLogs({ users, gcs }) {
  if (!canLogin()) {
    debug(
      "Skipping coordinate update. Missing GC_USERNAME, GC_PASSWORD, and GC_CONSUMER_KEY"
    );
    return;
  }

  let accessToken = null;
  const userDocs = await users
    .find({
      $or: [
        { fetch_date: { $exists: false } },
        { fetch_date: { $lt: hoursAgo(23) } }
      ]
    })
    .toArray();
  for (const user of userDocs) {
    debug("Updating %s's logs", user._id);
    if (!accessToken) {
      accessToken = await login();
    }
    const logs = await fetchLogs(user, users, gcs, accessToken);
    await mergeLogs(user._id, gcs, logs);
    await users.update(
      { _id: user._id },
      { $set: { fetch_date: new Date() } },
      { upsert: true }
    );
  }
}

module.exports = processLogs;
