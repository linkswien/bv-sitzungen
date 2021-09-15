const config = {
  calendarName: 'example-calendar-name',
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
