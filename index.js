const tsdav = require('tsdav')
const ical = require('ical-generator')
const childProcess = require('child_process')
const config = require('./config.js')
const fs = require("fs");
const path = require("path");

function execute(command) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, (error, stdout, stderr) => {
      if (error == null) {
        resolve({stdout, stderr})
      } else {
        reject(error)
      }
    })
  });
}

(async () => {
  console.log("Loading events using web scraper")

  const tempOutputFile = path.resolve("./.temp-output.json")
  let events;
  try {
    await execute(`java -Xmx100M -jar "${config.scraperJar}" "${tempOutputFile}"`);
    events = JSON.parse(fs.readFileSync(tempOutputFile, "utf-8"))
  } finally {
    if (fs.existsSync(tempOutputFile)) {
      fs.unlinkSync(tempOutputFile)
    }
  }

  console.log(`Found ${events.length} events. Syncing them`)

  const districts = [...new Set(events.map(event => String(event["district"]).padStart(2, '0')))];
  const client = await tsdav.createDAVClient(config.DAVClient)

  // Fetch all calendars and select the one with configured name
  const calendars = await client.fetchCalendars()
  const calendar = calendars.find(calendar => calendar.displayName === config.calendarName)

  if (!calendar) {
    throw "Calendar name not found"
  }

  // Fetch all calendar objects (=events) from configured calendar
  const calendarObjects = await client.fetchCalendarObjects({
    calendar: calendar
  })

  // Delete all events from districts that will be updated
  const deleteOldEvents = districts.map(district => {
    console.log(`Deleting all events from BV${district}`)
    const districtCalendarObjects = calendarObjects.filter(object => object.url.includes(`sitzung-BV${district}`))

    return districtCalendarObjects.map((object) => {
      console.log('Deleting existing event', object.url)
      return client.deleteCalendarObject({
        calendarObject: {
          url: object.url,
        }
      })
    })
  })

  // Wait until all old events are deleted
  Promise.allSettled(deleteOldEvents)
    // then another 3 sec
    .then(() => new Promise(resolve => setTimeout(() => resolve(), 3000)))
    .then(() => {
      const createPromises = events.map((event) => {
        if (!config.filterDistricts.includes(event.district)) {
          console.log(`Skip district ${event.district}`)
          return
        }
        console.log(`Adding new event to calendar ${event.district}`)

        const createICalString = (event) => {
          const newIcalObject = ical()
          newIcalObject.createEvent({
            start: new Date(event.date),
            end: new Date(event.date + 3600000),
            summary: `Sitzung der Bezirksvertretung ${event.district}`,
            description: event.additionalInfo,
            location: event.address,
          })
          return newIcalObject.toString()
        }

        return client.createCalendarObject({
          calendar: calendar,
          filename: `sitzung-BV${String(event.district).padStart(2, '0')}-${event.date}.ics`,
          iCalString: createICalString(event),
        }).then((response) => console.log(response.statusText, event.district, event.date))
      })

      return Promise.all(createPromises)
    })
    .then(() => {
      console.log("Successfully synced all events")
    })
})().catch(err => console.log(err))
