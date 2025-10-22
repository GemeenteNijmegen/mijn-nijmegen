import { Util } from "../Util";

test('Date util', () => {
  const today = new Date();
  const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const dayBeforeYesterday = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
  const dayBeforeTheDayBeforeYesterday = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3);
  expect(Util.isLessThanDaysAgo(getTimeStamp(today))).toBe(true)
  expect(Util.isLessThanDaysAgo(getTimeStamp(yesterday))).toBe(true)
  expect(Util.isLessThanDaysAgo(getTimeStamp(dayBeforeYesterday))).toBe(true)
  expect(Util.isLessThanDaysAgo(getTimeStamp(dayBeforeTheDayBeforeYesterday))).toBe(false);
})

function getTimeStamp(date: Date) {
  return date.toISOString().substring(0, 'YYYY-MM-DD'.length)
}