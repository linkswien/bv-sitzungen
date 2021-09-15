const tsdav = require('tsdav')
const ical = require('ical-generator')
const config = require('./config.js')

const events = [
  {
    "district": 20,
    "date": 1639587600000,
    "address": "HdB Brigittenau, 1200 Wien, Raffaelgasse 11-13",
    "additionalInfo": "Aufgrund der Covid19-Maßnahmen Livestream - nur limitierte Besucherzahl. Anmeldung in der BV 20 erforderlich!"
  },
  {
    "district": 2,
    "date": 1639587600000,
    "address": "Catamaran",
    "additionalInfo": "Aufgrund der Covid19-Maßnahmen Livestream - nur limitierte Besucherzahl. Anmeldung in der BV 2 erforderlich!"
  },
]

// Get all districts about to be updated
const districts = [...new Set(events.map(event => String(event.district).padStart(2, '0')))];

(async () => {
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
  deleteOldEvents = districts.map(district => {
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
      events.map((event) => {
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
          const newIcalString = newIcalObject.toString()
          return newIcalString
        }

        const result = client.createCalendarObject({
          calendar: calendar,
          filename: `sitzung-BV${String(event.district).padStart(2, '0')}-${event.date}.ics`,
          iCalString: createICalString(event),
        }).then((response) => console.log(response.statusText, event.district, event.date))
      })
    })

})().catch(err => console.log(err))
