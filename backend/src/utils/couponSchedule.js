const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

const dateParts = date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdays[get('weekday')], minute: Number(get('hour')) * 60 + Number(get('minute')) };
};

const minuteOfDay = value => {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const isCouponScheduleActive = (coupon, date = new Date()) => {
  const activeDays = Array.isArray(coupon?.activeDays) ? coupon.activeDays : [];
  const hasHours = Boolean(coupon?.activeHours?.start || coupon?.activeHours?.end);
  if (!activeDays.length && !hasHours) return true;
  const { weekday, minute } = dateParts(date);
  const start = hasHours ? minuteOfDay(coupon.activeHours.start) : null;
  const end = hasHours ? minuteOfDay(coupon.activeHours.end) : null;
  if (hasHours && (start === null || end === null || start === end)) return false;

  let scheduleDay = weekday;
  let withinHours = true;
  if (hasHours && start < end) withinHours = minute >= start && minute < end;
  else if (hasHours && start > end) {
    withinHours = minute >= start || minute < end;
    if (minute < end) scheduleDay = (weekday + 6) % 7;
  }
  return withinHours && (!activeDays.length || activeDays.includes(scheduleDay));
};

module.exports = { BUSINESS_TIME_ZONE, minuteOfDay, isCouponScheduleActive };
