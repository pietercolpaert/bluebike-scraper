const request = require('request-promise-native');
const htmlparser = require("htmlparser2");
const url = require('url');

// Adds the corresponding alert_id to each alert_time
exports.parseJsonObject = function(item, base_url) {
  let obj = {};

  // Add fields in json
  obj.lat = item.lat;
  obj.lon = item.lon;
  obj.name = item.label;

  // Parse html
  let html = item.popup;

  // Fields for parsing html
  let address_html = false;
  let postal_code_html = false;
  let city_html = false;
  let route_description_html = false;
  let field__item_even_html = false;
  let field_item_even_html = false;

  // Address fields
  let address = "";
  let postal_code = "";
  let city = "";

  // Availability url
  let availability_url = "";

  const parser = new htmlparser.Parser({
    onopentag: (name, attribs) => {
      if (name === "div" && attribs.class === "thoroughfare") {
        address_html = true;
      } else if (name === "span" && attribs.class === "postal-code") {
        postal_code_html = true;
      } else if (name === "span" && attribs.class === "locality") {
        city_html = true;
      } else if (name === "div" && attribs.class === "field field--name-field-localization field--type-text-long field--label-hidden") {
        route_description_html = true;
      } else if (name === "a" && attribs.class === "use-ajax btn--realtime") {
        availability_url = url.resolve(base_url, attribs.href.replace("nojs", "ajax"));
      } else if (name === "div" && attribs.class === "field__item even") {
        field__item_even_html = true;
      } else if (name === "div" && attribs.class === "field-item even") {
        field_item_even_html = true;
      }
    },
    ontext: (text) => {
      if (address_html) {
        address = text;
        address_html = false;
      } else if (postal_code_html) {
        postal_code = text;
        postal_code_html = false;
      } else if (city_html) {
        city = text;
        city_html = false;
      } else if (route_description_html) {
        obj.route_description = text;
        route_description_html = false;
      } else if (field__item_even_html) {
        field__item_even_html = false;
        if (text.startsWith("€")) {
          obj.tariff = text;
        }
      } else if (field_item_even_html) {
        field_item_even_html = false;
        if (text.startsWith("Je kan hier tijdelijk")) {
          obj.available = true;
        }
      }
    }
  }, {decodeEntities: true});
  parser.write(html);
  parser.end();

  // Add availability true if not unavailable
  if (!obj.hasOwnProperty('available')) {
    obj.available = true;
  }

  // Add stringified address
  obj.address = `${address}, ${postal_code} ${city}`;

  if (availability_url !== "") {
    // Add realtime availability
    console.error(`Fetching ${availability_url}`);
    return request(availability_url).then(body => {
      let html = JSON.parse(body)[1].data;
      let availability_html = false;

      const parser = new htmlparser.Parser({
        onopentag: (name, attribs) => {
          if(name === "strong"){
            availability_html = true;
          }
        },
        ontext:(text) => {
          if (availability_html) {
            let data = text.split(" / ");
            data[0] = parseInt(data[0]);
            data[1] = parseInt(data[1]);
            obj.bikes_available = data[0];
            obj.capacity = data[1];
            obj.docks_available = data[1] - data[0];
            availability_html = false;
          }
        }
      }, {decodeEntities: true});
      parser.write(html);
      parser.end();
      return obj;
    }).catch((err) => {
      console.error(`Failed to fetch ${availability_url} - ${err.code}`);
      return obj;
    });
  } else {
    return Promise.resolve(obj);
  }
};
