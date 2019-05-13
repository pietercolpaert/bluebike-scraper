const request = require('request-promise-native');
const {parseJsonObject} = require('./parseJson');
const {ArrayIterator} = require('asynciterator');

const base_url = "https://www.blue-bike.be/";

exports.scrapeBluebike = function (url, rate) {
  console.error(`Fetching ${url}`);
  return request(url).then(result => {
    // fix single quote parser problem, see issue #5
    const body = result.replace(/\\u0026#039;/gim, "'");

    // Extract JSON with relevant data from html
    let lines = body.split('\n');
    let html_line = "";

    lines.forEach((line) => {
      if (line.startsWith("<script>jQuery.extend(Drupal.settings")) {
        html_line = line;
      }
    });

    let front = "<script>jQuery.extend(Drupal.settings, ".length;
    let back = ');</script>'.length;

    html_line = html_line.substr(front).slice(0, -back);

    let features = JSON.parse(html_line).leaflet[0].features;

    // Extract relevant data from json object
    let objectsIterator = (new ArrayIterator(features)).transform((item, done) => {
      parseJsonObject(item, base_url).then((obj) => {
        objectsIterator._push(obj);
        done();
      });
    });
    return objectsIterator;
  });
};

