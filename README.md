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
