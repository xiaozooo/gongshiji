import { getLocalDate } from './time.js'

export function resolveCopyDate(record) {
    if (!record) return null
    if (typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) return record.date
    if (record.startTimestamp) return getLocalDate(record.startTimestamp)
    return null
}
