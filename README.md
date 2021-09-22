# bvs-scraper-to-caldav

Calls `bvs-scraper` to fetch all published meetings of the Wiener Bezirksvertretungen from [wien.gv.at](https://wien.gv.at), then pushes them to a CalDAV calendar of your choice.

## Set up

```
# Install dependencies
npm install

# Create & edit configuration
cp config.example.js config.js
vim config.js

# Run
node index.js
```
