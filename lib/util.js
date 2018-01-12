function daysAgo(days) {
  let date = new Date();
  date.setTime(date.getTime() - 24 * 60 * 60 * 1000 * days);
  return date;
}

module.exports = {
  daysAgo
};
