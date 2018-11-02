#!/usr/bin/env nodejs
const scrapeBluebike = require('../lib/scraper').scrapeBluebike;
const ldfetch = new (require('ldfetch'))({headers: { accept : 'application/ld+json' }});


let rate = 1;
let scrape_bluebike = scrapeBluebike("https://www.blue-bike.be/nl/zoek-een-blue-bike-punt", rate);

var context = {
  "name": { "@id": "http://xmlns.com/foaf/0.1/name",
            "@type":"http://www.w3.org/2001/XMLSchema#string"},
  "longitude": {"@id":"http://www.w3.org/2003/01/geo/wgs84_pos#long",
                "@type":"http://www.w3.org/2001/XMLSchema#string"},
  "latitude": {"@id":"http://www.w3.org/2003/01/geo/wgs84_pos#lat",
               "@type":"http://www.w3.org/2001/XMLSchema#string"},
  "alternative": {"@id": "http://purl.org/dc/terms/alternative",
                  "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
                  "@container":"@set"
                 }
};

console.error('Fetching ' + 'https://irail.be/stations/NMBS/');
ldfetch.get('https://irail.be/stations/NMBS/').then((response) => {
  
  return ldfetch.frame(response.triples,
                       { "@context": context }).then( (json) => json["@graph"]);
}).then(stations => {
  scrape_bluebike.then((it) => {
    // First slow it down to a pace of 100ms per HTTP request
    // Then also check for iRail stations nearby
    
    let slowIt = it.transform((data, done) => {
      var promises = [new Promise((resolve) => {
        setTimeout(function () {
          resolve();
        }, 100)
      })];

      //reconciliation of nearby stations
      for (let station of stations) {
        if ((station.name && station.name === data.name ) || (station.alternative && station.alternative.indexOf(data.name) > -1  )) {
          data.nearby = station;
        }
      }
      
      slowIt._push(data);
      
      Promise.all(promises).then(() => {
        done();
      });
    });

    var contextOut = context;
    contextOut.xsd = "http://www.w3.org/2001/XMLSchema#";
    contextOut.features = "@graph";
    contextOut.properties = "@graph";
    contextOut.generatedAtTime = {
      "@id": "http://www.w3.org/ns/prov#generatedAtTime",
      "@type": "xsd:date"
    };
    contextOut.nearby = "http://www.geonames.org/ontology#nearby";
    
    var geoJsonLdObject = {
      "@context": contextOut,
      "type": "FeatureCollection",
      "features": []
    };
    
    slowIt.each((data) => {
      //geojson-ify data
      let object = {};
      object.type = "Feature";
      object.geometry = {
        "type": "Point",
        "coordinates": [data.lon, data.lat],
      }
      object.generatedAtTime = (new Date()).toISOString();
      object.properties = {
        "@id": "http://irail.be/stations/bluebike/" + data.name,
        "@type": "http://schema.org/ParkingFacility",
        "name": data.name,
        "longitude": data.lon,
        "latitude": data.lat,
        'bikes_available': data.bikes_available,
        'capacity': data.capacity,
        'docks_available': data.docks_available
      }
      if (data.nearby)
        object.properties.nearby = data.nearby;
      
      geoJsonLdObject.features.push(object);
    });

    slowIt.on('end',() => {
      console.log(JSON.stringify(geoJsonLdObject));
    });

  });
});

