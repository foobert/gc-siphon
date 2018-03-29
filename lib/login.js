const debug = require("debug")("gc:siphon:login");
const request = require("superagent");

async function login() {
  debug("Logging in");
  const res = await request
    .post("https://api.groundspeak.com/LiveV6/Geocaching.svc/internal/Login")
    .accept("json")
    .query({ format: "json" })
    .send({
      ConsumerKey: process.env.GC_CONSUMER_KEY,
      UserName: process.env.GC_USERNAME,
      Password: process.env.GC_PASSWORD
    });
  const accessToken = res.body.GroundspeakAccessToken;
  debug("Access token: %s", accessToken);
  return accessToken;
}

function canLogin() {
  return (
    process.env.GC_USERNAME &&
    process.env.GC_PASSWORD &&
    process.env.GC_CONSUMER_KEY
  );
}

module.exports = {
  login,
  canLogin
};
