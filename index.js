const tsdav = require('tsdav')
const ical = require('ical-generator')
const childProcess = require('child_process')
const config = require('./config.js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const districtName = (district) => {
  const districts = {
    1: 'Innere Stadt',
    2: 'Leopoldstadt',
    3: 'Landstraße',
    4: 'Wieden',
    5: 'Margareten',
    6: 'Mariahilf',
    7: 'Neubau',
    8: 'Josefstadt',
    9: 'Alsergrund',
    10: 'Favoriten',
    11: 'Simmering',
    12: 'Meidling',
    13: 'Hietzing',
    14: 'Penzing',
    15: 'Rudolfsheim-Fünfhaus',
    16: 'Ottakring',
    17: 'Hernals',
    18: 'Währing',
    19: 'Döbling',
    20: 'Brigittenau',
    21: 'Floridsdorf',
    22: 'Donaustadt',
    23: 'Liesing'
  }
  return districts[district]
}

function execute(command) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, (error, stdout, stderr) => {
      if (error == null) {
        resolve({stdout, stderr})
      } else {
        reject(error)
      }
    })
  })
}

(async () => {
  console.log('Loading events using web scraper...')

  let events
  try {
    await execute(`java -Xmx100M -jar "${config.scraperJar}" "${config.scraperJarOutput}"`)
    events = JSON.parse(fs.readFileSync(config.scraperJarOutput, 'utf-8'))
  } finally {
    if (fs.existsSync(config.scraperJarOutput)) {
      fs.unlinkSync(config.scraperJarOutput)
    }
  }

  console.log(`Done! Found ${events.length} events. Syncing them...`)

  // if filterDistricts is defined in config.js, use it to create array to loop over, else all updated districts
  const districts = config.filterDistricts
    ? config.filterDistricts.map(district => String(district).padStart(2, '0'))
    : [...new Set(events.map(event => String(event['district']).padStart(2, '0')))]
  const client = await tsdav.createDAVClient(config.DAVClient)

  // Fetch all calendars and select the one with configured name
  const calendars = await client.fetchCalendars()
  const calendar = calendars.find(calendar => calendar.displayName === config.calendarName)

  if (!calendar) {
    throw 'Calendar name not found. Abort!'
  }

  // Fetch all calendar objects (=events) from configured calendar
  const calendarObjects = await client.fetchCalendarObjects({
    calendar: calendar
  })

  // Delete all events from districts that will be updated
  const deleteOldEvents = districts.map(district => {
    const districtCalendarObjects = calendarObjects.filter(object => object.url.includes(`sitzung-BV${district}`))
    console.log(`Deleting ${districtCalendarObjects.length} events from BV${district}`)

    return districtCalendarObjects.map((object) => {
      return new Promise(resolve => {
        client.deleteCalendarObject({
          calendarObject: {
            url: object.url,
          }
        }).then((response) => {
          console.log(response.status === 204 ? `Deleted ${response.url}` : `${responseStatus} ${response.statusText}: ${response.url}`)
          resolve()
        })
      })
    })
  }).flat()

  // Wait until all old events are deleted
  Promise.allSettled(deleteOldEvents)
    // then another 3 sec
    .then(() => new Promise(resolve => setTimeout(() => resolve(), 3000)))
    .then(() => {
      const createPromises = events.map((event) => {
        if (config.filterDistricts && !config.filterDistricts.includes(event.district)) {
          return
        }
        console.log(`Adding new event from BV${String(event.district).padStart(2, '0')}`)

        const createICalString = (event) => {
          const newIcalObject = ical()
          newIcalObject.createEvent({
            start: new Date(event.date),
            end: new Date(event.date + 3600000),
            summary: `[BV${String(event.district).padStart(2, '0')}] Bezirksvertretungssitzung ${districtName(event.district)}`,
            description: event.additionalInfo,
            location: event.address,
          })
          return newIcalObject.toString()
        }

        return client.createCalendarObject({
          calendar: calendar,
          filename: `sitzung-BV${String(event.district).padStart(2, '0')}-${event.date}-${crypto.randomUUID()}.ics`,
          iCalString: createICalString(event),
        }).then((response) => console.log(response.status === 201 ? `Created ${response.url}` : `${responseStatus} ${response.statusText}: ${response.url}`))
      })

      return Promise.all(createPromises)
    })
    .then(() => {
      console.log('Sync finished!')
    })
})().catch(err => console.log(err))
