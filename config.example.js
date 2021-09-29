const config = {
  scraperJar: 'scraper.jar',
  scraperJarOutput: '/tmp/bvs-scraper-output.json',
  calendarName: 'example-calendar-name',
  filterDistricts: [ 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 17, 20 ], // optional
  DAVClient: {
    serverUrl: 'https://cloud.links-wien.at/remote.php/dav/calendars/*username*/',
    credentials: {
      username: '*username*',
      password: '*password*',
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  },
}

module.exports = config;
