const cheerio = require("cheerio");
const cookie = require("cookie");
const debug = require("debug")("gc-lookup");
const request = require("superagent");
const Coordinates = require("coordinate-parser");

const update = require("./update");
const { daysAgo } = require("./util");

async function fetch(gc) {
  debug("Fetch %s (with auth)", gc);
  const res = await request
    .get(`https://www.geocaching.com/geocache/${gc}`)
    .set("Cookie", await authCookie())
    .ok(res => res.status < 400)
    .redirects(5);
  return res.text;
}

function parse(html) {
  $ = cheerio.load(html);
  const gc = $(".CoordInfoCode").text();
  const raw = $("#uxLatLon").text();
  const position = new Coordinates(raw);
  const coords = {
    lon: position.getLongitude(),
    lat: position.getLatitude(),
    raw
  };
  debug("%s: %s -> %o", gc, raw, coords);
  return coords;
}

function parseCookies(result) {
  const header = result.header["set-cookie"];
  if (!header) {
    return {};
  }
  return header.map(cookie.parse).reduce((acc, x) => Object.assign(acc, x), {});
}

let authCookieCache = null;

async function authCookie() {
  if (authCookieCache) {
    return authCookieCache;
  }

  debug("Logging in");

  const rvt = "__RequestVerificationToken";
  const loginForm = await request("https://www.geocaching.com/account/login");
  debug("Login GET %d", loginForm.status);

  const firstVerificationToken = parseCookies(loginForm)[rvt];
  const html = cheerio.load(loginForm.text);
  const secondVerificationToken = html(`input[name='${rvt}']`).val();

  const username = process.env.GC_USERNAME;
  const password = process.env.GC_PASSWORD;

  const login = await request
    .post("https://www.geocaching.com/account/login")
    .type("form")
    .redirects(0)
    .ok(res => res.status < 400)
    .set("Cookie", cookie.serialize(rvt, firstVerificationToken))
    .send({
      [rvt]: secondVerificationToken,
      Username: username,
      Password: password
    });

  debug("Login POST %d", login.status);

  const authValue = parseCookies(login).gspkauth;

  authCookieCache = cookie.serialize("gspkauth", authValue);
  debug("Auth cookie: %s", authCookieCache);
  return authCookieCache;
}

async function processCoords(collection) {
  if (!process.env.GC_USERNAME || !process.env.GC_PASSWORD) {
    debug("Skipping coordinate update. Missing GC_USERNAME and GC_PASSWORD");
    return;
  }

  debug("Updating coordinates");
  const fresh = false;
  const query = fresh
    ? {}
    : {
        "parsed.premium": false,
        $or: [
          { coord: { $exists: false } },
          { coord_date: { $lt: daysAgo(60) } }
        ]
      };
  await update(
    collection,
    query,
    async doc => {
      return {
        coord: parse(await fetch(doc.gc)),
        coord_date: new Date()
      };
    },
    5
  );
}

module.exports = processCoords;
