/**
 * Time utilities: cross-day splitting, overlap check, formatting
 */

/** Get local date string YYYY-MM-DD from a timestamp */
export function getLocalDate(timestamp) {
    const d = new Date(timestamp)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

/** Get YYYY-MM from a timestamp */
export function getYearMonth(timestamp) {
    return getLocalDate(timestamp).slice(0, 7)
}

/** Format hours to 2 decimal places string */
export function formatHours(h) {
    return Number(h).toFixed(2)
}

/** Format a timestamp as HH:MM */
export function formatTime(timestamp) {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Format a date string YYYY-MM-DD as localized Chinese date */
export function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

/** Format a date string YYYY-MM-DD as short date like 3月4日 */
export function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-')
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    const today = new Date()
    const todayStr = getLocalDate(today.toISOString())
    if (dateStr === todayStr) return '今天'
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (dateStr === getLocalDate(yesterday.toISOString())) return '昨天'
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

/** Calculate hours between two timestamps */
export function calcHours(startTs, endTs) {
    const diff = (new Date(endTs) - new Date(startTs)) / 3600000
    return Math.round(diff * 100) / 100
}

/**
 * Split a time range across midnight boundaries.
 * Returns array of { startTimestamp, endTimestamp, date, isSplit, hours }
 */
export function splitCrossDay(startTs, endTs) {
    const start = new Date(startTs)
    const end = new Date(endTs)

    if (getLocalDate(startTs) === getLocalDate(endTs)) {
        const hours = calcHours(startTs, endTs)
        return [{
            startTimestamp: start.toISOString(),
            endTimestamp: end.toISOString(),
            date: getLocalDate(startTs),
            yearMonth: getYearMonth(startTs),
            isSplit: false,
            hours
        }]
    }

    const splits = []

    // First segment: start → 23:59:59.999 of start day
    const endOfDay = new Date(start)
    endOfDay.setHours(23, 59, 59, 999)
    splits.push({
        startTimestamp: start.toISOString(),
        endTimestamp: endOfDay.toISOString(),
        date: getLocalDate(start.toISOString()),
        yearMonth: getYearMonth(start.toISOString()),
        isSplit: true,
        hours: calcHours(start.toISOString(), endOfDay.toISOString())
    })

    // Middle full days
    let cur = new Date(endOfDay.getTime() + 1)
    while (getLocalDate(cur.toISOString()) !== getLocalDate(endTs)) {
        const endCur = new Date(cur)
        endCur.setHours(23, 59, 59, 999)
        splits.push({
            startTimestamp: cur.toISOString(),
            endTimestamp: endCur.toISOString(),
            date: getLocalDate(cur.toISOString()),
            yearMonth: getYearMonth(cur.toISOString()),
            isSplit: true,
            hours: calcHours(cur.toISOString(), endCur.toISOString())
        })
        cur = new Date(endCur.getTime() + 1)
    }

    // Last segment: 00:00:00 of end day → end
    const startOfEndDay = new Date(end)
    startOfEndDay.setHours(0, 0, 0, 0)
    splits.push({
        startTimestamp: startOfEndDay.toISOString(),
        endTimestamp: end.toISOString(),
        date: getLocalDate(end.toISOString()),
        yearMonth: getYearMonth(end.toISOString()),
        isSplit: true,
        hours: calcHours(startOfEndDay.toISOString(), end.toISOString())
    })

    return splits
}

/** Check if two time ranges overlap */
export function timesOverlap(start1, end1, start2, end2) {
    return new Date(start1) < new Date(end2) && new Date(end1) > new Date(start2)
}

/** Return current local datetime as an input[type=datetime-local] compatible string */
export function nowLocalInput() {
    const d = new Date()
    d.setSeconds(0, 0)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse a datetime-local input value to ISO string */
export function localInputToISO(val) {
    return new Date(val).toISOString()
}

/** Convert local date/time values (YYYY-MM-DD + HH:MM) to ISO UTC string */
export function localDateTimeToISO(dateVal, timeVal) {
    const [y, m, d] = dateVal.split('-').map(Number)
    const [hh, mm] = timeVal.split(':').map(Number)
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).toISOString()
}

/** Format a timestamp to local datetime-local input value (YYYY-MM-DDTHH:MM) — avoids UTC shift */
export function toLocalInputValue(timestamp) {
    const d = new Date(timestamp)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Add hours to a datetime-local string */
export function addHoursToLocalInput(localStr, hours) {
    const d = new Date(localStr)
    d.setTime(d.getTime() + hours * 3600000)
    return d.toISOString()
}

/** Calculate minutes between two timestamps */
export function calcMinutes(startTs, endTs) {
    const diff = (new Date(endTs) - new Date(startTs)) / 60000
    return Math.round(diff)
}

/** Calculate net work minutes after subtracting optional break minutes */
export function calcNetWorkMinutes(totalMinutes, breakMinutes = 0) {
    const total = Math.max(0, Number(totalMinutes) || 0)
    const rest = Math.max(0, Number(breakMinutes) || 0)
    return Math.max(0, total - rest)
}

/** Format minutes as human-readable string, e.g. 90 → "1小时30分钟" */
export function formatMinutes(min) {
    if (min <= 0) return '0 分钟'
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h === 0) return `${m} 分钟`
    if (m === 0) return `${h} 小时`
    return `${h} 小时 ${m} 分钟`
}

/** Get array of YYYY-MM strings for last N months */
export function getRecentMonths(n = 3) {
    const months = []
    const d = new Date()
    for (let i = 0; i < n; i++) {
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        d.setMonth(d.getMonth() - 1)
    }
    return months
}
