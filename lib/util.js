const moment = require("moment");

function daysAgo(days, now) {
  let date = new Date(now || new Date());
  date.setTime(date.getTime() - 24 * 60 * 60 * 1000 * days);
  return date;
}

function hoursAgo(hours, now) {
  let date = new Date(now || new Date());
  date.setTime(date.getTime() - 60 * 60 * 1000 * hours);
  return date;
}

function ageLabel(date) {
  if (date) {
    return moment(date).fromNow();
  } else {
    return "never";
  }
}

module.exports = {
  ageLabel,
  daysAgo,
  hoursAgo
};
