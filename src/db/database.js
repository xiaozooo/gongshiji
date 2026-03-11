import { openDB } from 'idb'

const DB_NAME = 'gongshiji-db'
const DB_VERSION = 1

let _db = null

export async function getDB() {
    if (_db) return _db
    _db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            // ── jobs store ──
            if (!db.objectStoreNames.contains('jobs')) {
                const jobStore = db.createObjectStore('jobs', { keyPath: 'id' })
                jobStore.createIndex('name', 'name', { unique: false })
                jobStore.createIndex('createdAt', 'createdAt')
                jobStore.createIndex('isDeleted', 'isDeleted')
            }

            // ── records store ──
            if (!db.objectStoreNames.contains('records')) {
                const recStore = db.createObjectStore('records', { keyPath: 'id' })
                recStore.createIndex('date', 'date')
                recStore.createIndex('jobId', 'jobId')
                recStore.createIndex('date_jobId', ['date', 'jobId'])
                recStore.createIndex('startTimestamp', 'startTimestamp')
                recStore.createIndex('yearMonth', 'yearMonth')
                recStore.createIndex('isDeleted', 'isDeleted')
            }

            // ── meta store ──
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' })
            }
        }
    })
    return _db
}

export async function getMeta(key) {
    const db = await getDB()
    const item = await db.get('meta', key)
    return item?.value
}

export async function setMeta(key, value) {
    const db = await getDB()
    await db.put('meta', { key, value, updatedAt: new Date().toISOString() })
}
