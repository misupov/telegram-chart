export function binarySearch(array: number[], element: number) {
  var m = 0;
  var n = array.length - 1;
  while (m <= n) {
    var k = (n + m) >> 1;
    var cmp = element - array[k];
    if (cmp > 0) {
      m = k + 1;
    }
    else if (cmp < 0) {
      n = k - 1;
    }
    else {
      return k;
    }
  }
  return -m - 1;
}

export function getDatesBetween(lastTime: number, timeFrom: number, timeTo: number, maxDates: number): number[] {
  const lastDate = Math.ceil(lastTime / oneDay) * oneDay;
  const dateFrom = Math.ceil(timeFrom / oneDay) * oneDay;
  let dateTo = Math.ceil(timeTo / oneDay) * oneDay;
  let daysBetween = (dateTo - dateFrom) / oneDay;
  daysBetween = (Math.pow(2, Math.ceil(Math.log2(daysBetween))));
  const c = Math.ceil(daysBetween / maxDates);
  dateTo = lastDate - (Math.ceil((lastDate - dateTo) / oneDay / c) * oneDay * c);
  return fullRange(dateTo, maxDates, Math.round(c));
}

function fullRange(lastDate: number, count: number, step: number) {
  const result: number[] = [];
  for (let index = 0; index < count; index++) {
    result.unshift(lastDate - step * oneDay * index);
  }
  return result;
}

let lastMinValue = 0;
let lastMaxValue = 0;
let lastCount = 0;
let lastResult: number[] = [];

export function getValuesBetween(minValue: number, maxValue: number, count: number) {
  if (lastMinValue === minValue && lastMaxValue === maxValue && lastCount === count) {
    return lastResult;
  }
  lastMinValue = minValue;
  lastMaxValue = maxValue;
  lastCount = count;

  const error = Math.pow(10, Math.floor(Math.log10(maxValue - minValue)) - 1);
  minValue = Math.ceil(minValue / error) * error;
  maxValue = Math.floor(maxValue / error) * error;
  let inc = (maxValue - minValue) / (count-1);
  inc = Math.ceil(inc / error) * error;
  const result: number[] = [];
  for (let index = 0; index < count; index++) {
    result.push(minValue + Math.round(inc * index));
  }
  lastResult = result;
  return result;
}

export enum DateFormat {
  Short,
  Medium,
  Full
}

export function formatDate(date: Date, format: DateFormat) {
  switch (format) {
    case DateFormat.Short:return month[date.getMonth()] + ' ' + date.getDate();
    case DateFormat.Medium: return `${weekday[date.getDay()]}, ${date.getDate()} ${month[date.getMonth()]} ${date.getFullYear()}`;
    default: return `${date.getDate()} ${month[date.getMonth()]} ${date.getFullYear()}`
  }
}

export function getComputed(prop: string, el: HTMLElement) {
  return parseFloat((getComputedStyle(el) as any)[prop]);
}

export function changeSaturation(r: number, g: number, b: number, change: number) {
  const P = Math.sqrt(r * r * .299 + g * g * .587 + b * b * .114);
  return [P + (r - P) * change, P + (g - P) * change, P + (b - P) * change];
}

export const oneDay = 24 * 60 * 60 * 1000;
const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
