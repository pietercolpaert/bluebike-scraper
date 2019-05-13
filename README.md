# Blue Bike Scraper

Private repository to make a scraper for blue bike data.

What it does: it will contact all the real-time datasets for all stops of Blue Bike as found on their website

It will then generate a GeoJSON.

In order to use this in production, we would advice to add a cronjob that performs this each ~10 minutes

Use it:

```
npm install # you’ll need node >=10 installed
./bin/scrape.js > yourfile.geojson
```

To perform a full running, adding a route description and address in Dutch, French and English, add the `--full` flag:  
```
./bin/scrape.js --full > yourfile.geojson
```
As routes and addresses barely change, it is not necessary to run this often.
