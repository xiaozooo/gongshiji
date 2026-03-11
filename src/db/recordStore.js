import { getDB } from './database.js'
import { getLocalDate } from '../utils/time.js'

export async function addRecord(data) {
    const db = await getDB()
    const now = new Date().toISOString()
    const record = {
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        memo: '',
        isSplit: false,
        breakMinutes: 0,
        source: 'manual',
        ...data,
        id: data.id || crypto.randomUUID()
    }
    await db.put('records', record)
    return record
}

export async function updateRecord(id, data) {
    const db = await getDB()
    const existing = await db.get('records', id)
    if (!existing) throw new Error('Record not found')
    const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() }
    await db.put('records', updated)
    return updated
}

export async function deleteRecord(id) {
    const db = await getDB()
    const existing = await db.get('records', id)
    if (!existing) throw new Error('Record not found')
    const updated = { ...existing, isDeleted: true, updatedAt: new Date().toISOString() }
    await db.put('records', updated)
    return updated
}

export async function hardDeleteRecord(id) {
    const db = await getDB()
    await db.delete('records', id)
}

export async function getRecord(id) {
    const db = await getDB()
    return db.get('records', id)
}

export async function getRecordsByDate(date) {
    const db = await getDB()
    const all = await db.getAllFromIndex('records', 'date', date)
    return all.filter(r => !r.isDeleted)
}

export async function getRecordsByMonth(yearMonth) {
    const db = await getDB()
    const all = await db.getAllFromIndex('records', 'yearMonth', yearMonth)
    return all.filter(r => !r.isDeleted)
}

export async function getRecordsByDateRange(startDate, endDate) {
    const db = await getDB()
    const range = IDBKeyRange.bound(startDate, endDate)
    const all = await db.getAllFromIndex('records', 'date', range)
    return all.filter(r => !r.isDeleted)
}

export async function getAllRecords() {
    const db = await getDB()
    const all = await db.getAll('records')
    return all.filter(r => !r.isDeleted)
}

export function pickLatestRecord(records) {
    if (!records?.length) return null
    const ordered = [...records].sort((a, b) => {
        const aCreated = new Date(a.createdAt || 0).getTime()
        const bCreated = new Date(b.createdAt || 0).getTime()
        if (bCreated !== aCreated) return bCreated - aCreated
        const aUpdated = new Date(a.updatedAt || 0).getTime()
        const bUpdated = new Date(b.updatedAt || 0).getTime()
        if (bUpdated !== aUpdated) return bUpdated - aUpdated
        return new Date(b.startTimestamp || 0).getTime() - new Date(a.startTimestamp || 0).getTime()
    })
    return ordered[0]
}

export async function getLatestRecord() {
    const all = await getAllRecords()
    return pickLatestRecord(all)
}

export async function getRecordsByDateAndJob(date, jobId) {
    const db = await getDB()
    const all = await db.getAllFromIndex('records', 'date_jobId', IDBKeyRange.only([date, jobId]))
    return all.filter(r => !r.isDeleted)
}

/** Check overlap: returns all records in the same date (any job) whose time range overlaps [startTs, endTs] */
export async function getOverlappingRecords(startTs, endTs, excludeId = null) {
    const db = await getDB()
    const start = new Date(startTs)
    const end = new Date(endTs)
    const startDate = getLocalDate(startTs)
    const endDate = getLocalDate(endTs)

    // gather all dates in range
    const dates = new Set()
    const cur = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')
    while (cur <= endD) {
        dates.add(getLocalDate(cur.toISOString()))
        cur.setDate(cur.getDate() + 1)
    }

    const candidates = []
    for (const d of dates) {
        const recs = await getRecordsByDate(d)
        candidates.push(...recs)
    }

    return candidates.filter(r => {
        if (r.isDeleted) return false
        if (excludeId && r.id === excludeId) return false
        const rStart = new Date(r.startTimestamp)
        const rEnd = new Date(r.endTimestamp)
        return start < rEnd && end > rStart
    })
}

/** Bulk import with transaction - returns { added, skipped, errors } */
export async function bulkImportRecords(records, jobs, conflict = 'append') {
    const db = await getDB()
    const tx = db.transaction(['records', 'jobs'], 'readwrite')
    const results = { added: 0, updated: 0, skipped: 0, errors: [] }

    try {
        // import jobs
        if (jobs) {
            for (const job of jobs) {
                const existing = await tx.objectStore('jobs').get(job.id)
                if (!existing) {
                    await tx.objectStore('jobs').put(job)
                }
            }
        }
        // import records
        for (const rec of records) {
            try {
                const existing = rec.id ? await tx.objectStore('records').get(rec.id) : null
                if (existing) {
                    if (conflict === 'overwrite') {
                        await tx.objectStore('records').put({ ...existing, ...rec })
                        results.updated++
                    } else {
                        results.skipped++
                    }
                } else {
                    await tx.objectStore('records').put({ ...rec, id: rec.id || crypto.randomUUID() })
                    results.added++
                }
            } catch (e) {
                results.errors.push({ record: rec, error: e.message })
            }
        }
        await tx.done
    } catch (e) {
        results.errors.push({ record: null, error: e.message })
    }
    return results
}
