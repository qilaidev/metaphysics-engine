const formatTimezoneOffset = (offsetMinutes) => {
  if (!Number.isFinite(offsetMinutes)) return 'UTC';
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseTimezoneOffsetMinutes = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(utc|gmt|z)$/i.test(trimmed)) return 0;
  const match = trimmed.match(/^(?:utc|gmt)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 14 || minutes > 59)
    return null;
  return sign * (hours * 60 + minutes);
};

const getOffsetMinutesFromTimeZone = (timeZone, date) => {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return null;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(date);
    const values = {};
    parts.forEach((part) => {
      if (part.type !== 'literal') values[part.type] = part.value;
    });
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour) % 24,
      Number(values.minute),
      Number(values.second)
    );
    if (!Number.isFinite(asUtc)) return null;
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch (error) {
    return null;
  }
};

/**
 * 某 IANA 时区在「某个墙钟时刻」的偏移。
 *
 * 偏移是瞬时的函数，而手里只有墙钟。把墙钟当 UTC 去查，查到的是差了整整一个偏移量的
 * 另一个瞬时上的偏移 —— 平时无妨，DST 转换之后 |偏移| 小时之内会取到转换前的值：
 * 纽约 2024-03-10 03:30 取成 −5 而非 −4，上海 1988-04-10 03:30 取成 +8 而非 +9，
 * 真太阳时与时柱随之错一小时，且不报错。
 *
 * 做法是迭代：拿第一次的偏移把墙钟换成真正的瞬时，再查一次，直到稳定。
 * 春季跳过的那一小时（不存在的时刻）两次结果会来回摆，最多迭代两轮后取当前值，
 * 与 JS Date 对不存在时刻的处理一致（按转换前的偏移顺延）；秋季重复的那一小时取第一次出现。
 */
const resolveZoneOffsetForWallClock = (timeZone, wallAsUtcMs) => {
  let offset = getOffsetMinutesFromTimeZone(timeZone, new Date(wallAsUtcMs));
  if (!Number.isFinite(offset)) return null;
  for (let round = 0; round < 2; round += 1) {
    const next = getOffsetMinutesFromTimeZone(timeZone, new Date(wallAsUtcMs - offset * 60000));
    if (!Number.isFinite(next) || next === offset) break;
    offset = next;
  }
  return offset;
};

const buildBirthTimeMeta = ({
  birthYear,
  birthMonth,
  birthDay,
  birthHour,
  birthMinute,
  timezone,
  timezoneOffsetMinutes,
}) => {
  const year = Number(birthYear);
  const month = Number(birthMonth);
  const day = Number(birthDay);
  const hour = Number.isFinite(Number(birthHour)) ? Number(birthHour) : 0;
  const minute = Number.isFinite(Number(birthMinute)) ? Number(birthMinute) : 0;
  if (![year, month, day].every(Number.isFinite)) {
    return { timezoneOffsetMinutes: null, birthTimestamp: null, birthIso: null };
  }

  const offsetFromPayload = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);
  const offsetFromLabel = parseTimezoneOffsetMinutes(timezone);
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetFromZone =
    offsetFromLabel === null ? resolveZoneOffsetForWallClock(timezone, wallAsUtcMs) : null;
  const resolvedOffset = Number.isFinite(offsetFromPayload)
    ? offsetFromPayload
    : Number.isFinite(offsetFromLabel)
      ? offsetFromLabel
      : offsetFromZone;

  if (!Number.isFinite(resolvedOffset)) {
    return { timezoneOffsetMinutes: null, birthTimestamp: null, birthIso: null };
  }

  const birthTimestamp =
    Date.UTC(year, month - 1, day, hour, minute, 0) - resolvedOffset * 60 * 1000;
  return {
    timezoneOffsetMinutes: resolvedOffset,
    birthTimestamp,
    birthIso: new Date(birthTimestamp).toISOString(),
  };
};

export {
  formatTimezoneOffset,
  parseTimezoneOffsetMinutes,
  getOffsetMinutesFromTimeZone,
  resolveZoneOffsetForWallClock,
  buildBirthTimeMeta,
};
