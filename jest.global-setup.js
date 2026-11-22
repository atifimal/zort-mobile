// Every test runs in a zone with daylight saving time, whatever the machine's zone is, so date
// arithmetic is tested across days of 23 and 25 hours (recurrence.test.ts). Set here, before
// the test workers start: changing TZ inside a test file isn't picked up on every platform.
module.exports = () => {
  process.env.TZ = 'America/New_York';
};
