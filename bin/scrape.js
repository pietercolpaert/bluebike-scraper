#!/usr/bin/env nodejs
const scrapeBluebike = require('../lib/scraper').scrapeBluebike;
const ldfetch = new (require('ldfetch'))({headers: { accept : 'application/ld+json' }});
const haversine = require('haversine');

const FULL_RUN = process.argv[2] === '--full';
let rate = 1;
const scrapedBluebikes = {
  nl: scrapeBluebike('https://www.blue-bike.be/nl/zoek-een-blue-bike-punt', rate)
};

if (FULL_RUN) {
  scrapedBluebikes.fr = scrapeBluebike('https://www.blue-bike.be/fr/cherchez-blue-bike-point', rate);
  scrapedBluebikes.en = scrapeBluebike('https://www.blue-bike.be/en/find-blue-bike-location', rate);
}

//Context for the JSON-LD of iRail -- Caveat: contains
var context = {
  "mv": "http://schema.mobivoc.org/",
  "name": { "@id": "http://xmlns.com/foaf/0.1/name",
            "@type":"http://www.w3.org/2001/XMLSchema#string"},
  "longitude": {"@id":"http://www.w3.org/2003/01/geo/wgs84_pos#long",
                "@type":"http://www.w3.org/2001/XMLSchema#float"},
  "latitude": {"@id":"http://www.w3.org/2003/01/geo/wgs84_pos#lat",
               "@type":"http://www.w3.org/2001/XMLSchema#float"},
  "alternative": {"@id": "http://purl.org/dc/terms/alternative",
                  "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
                  "@container":"@set"
                 }
};

const generateInitialObj = (it, stations) => new Promise((upperResolve) => {
  // First slow it down to a pace of 100ms per HTTP request
  // Then also check for iRail stations nearby
    
    let slowIt = it.transform((data, done) => {
      var promises = [new Promise((resolve) => {
        setTimeout(function () {
          resolve();
        }, 100)
      })];

      //reconciliation of nearby stations: there should be 1 station the nearest.
      let minDist = Infinity;
      for (let station of stations) {
        let start = {
          longitude: data.lon,
          latitude: data.lat
        };
        
        let distance = haversine(start, station);
        if (minDist > distance) { 
          minDist = distance;
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
    contextOut.longitude["@type"] = "xsd:float";
    contextOut.latitude["@type"] = "xsd:float";
    contextOut.features = "@graph";
    contextOut.properties = "@graph";
    contextOut.generatedAtTime = {
      "@id": "http://www.w3.org/ns/prov#generatedAtTime",
      "@type": "xsd:date"
    };
    contextOut.nearby = {
      "@id": "http://www.geonames.org/ontology#nearby",
      "@type": "@id"
    };
    contextOut.bikes_available = {
      "@id":"mv:capacity",
      "@type":"http://www.w3.org/2001/XMLSchema#integer"      
    };

    contextOut.capacity = {
      "@id": "mv:totalCapacity",
      "@type":"http://www.w3.org/2001/XMLSchema#integer"
    };
    
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
        "@id": "http://irail.be/stations/bluebike/" + encodeURIComponent(data.name),
        "@type": "http://schema.org/ParkingFacility",
        "name": data.name,
        "longitude": data.lon,
        "latitude": data.lat,
        'bikes_available': data.bikes_available,
        'capacity': data.capacity,
        'docks_available': data.docks_available
      }
      if (data.nearby)
        object.properties.nearby = data.nearby["@id"];
      
      geoJsonLdObject.features.push(object);
    });

    slowIt.on('end', () => upperResolve(geoJsonLdObject));
});

console.error('Fetching ' + 'https://irail.be/stations/NMBS/');
ldfetch.get('https://irail.be/stations/NMBS/').then((response) => {
  
  return ldfetch.frame(response.triples,
                       { "@context": context }).then( (json) => json["@graph"]);
}).then(async stations => {
  const it = await scrapedBluebikes.nl;
  const geoJsonLdObject = await generateInitialObj(it, stations);
  
  if (!FULL_RUN) {
    console.log(JSON.stringify(geoJsonLdObject));
    process.exit();
  }
});

