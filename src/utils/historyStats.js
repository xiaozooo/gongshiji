function pad(n) {
    return String(n).padStart(2, '0')
}

function toDateStr(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getWeekRange(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    const jsDay = base.getDay()
    const offsetToMonday = jsDay === 0 ? -6 : 1 - jsDay
    const start = new Date(base)
    start.setDate(base.getDate() + offsetToMonday)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: toDateStr(start), end: toDateStr(end) }
}

export function getMonthRange(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    return { start: toDateStr(start), end: toDateStr(end) }
}

export function aggregateDaily(records) {
    const map = new Map()
    for (const r of records) {
        const key = r.date
        if (!map.has(key)) map.set(key, { date: key, hours: 0, income: 0, records: 0 })
        const item = map.get(key)
        item.hours += Number(r.hours || 0)
        item.income += Number(r.hours || 0) * Number(r.wage || 0)
        item.records += 1
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function summarizeTotals(records) {
    const totalHours = records.reduce((s, r) => s + Number(r.hours || 0), 0)
    const totalIncome = records.reduce((s, r) => s + Number(r.hours || 0) * Number(r.wage || 0), 0)
    const workedDays = new Set(records.map(r => r.date)).size
    const avgHourly = totalHours > 0 ? totalIncome / totalHours : 0
    return { totalHours, totalIncome, workedDays, avgHourly, recordCount: records.length }
}

export function aggregateJobs(records) {
    const map = new Map()
    for (const r of records) {
        const key = r.jobId
        if (!map.has(key)) {
            map.set(key, {
                jobId: r.jobId,
                jobName: r.jobName,
                hours: 0,
                income: 0,
                records: 0,
                workedDates: new Set(),
                lastDate: r.date
            })
        }
        const item = map.get(key)
        const h = Number(r.hours || 0)
        const income = h * Number(r.wage || 0)
        item.hours += h
        item.income += income
        item.records += 1
        item.workedDates.add(r.date)
        if (r.date > item.lastDate) item.lastDate = r.date
    }
    return [...map.values()].map(i => ({
        jobId: i.jobId,
        jobName: i.jobName,
        hours: i.hours,
        income: i.income,
        records: i.records,
        workedDays: i.workedDates.size,
        avgHourly: i.hours > 0 ? i.income / i.hours : 0,
        lastDate: i.lastDate
    }))
}

export function enumerateDates(start, end) {
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    const cur = new Date(sy, sm - 1, sd)
    const endDate = new Date(ey, em - 1, ed)
    const out = []
    while (cur <= endDate) {
        out.push(toDateStr(cur))
        cur.setDate(cur.getDate() + 1)
    }
    return out
}
