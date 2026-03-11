/**
 * CSV generation and parsing for records
 * Columns: recordId, jobId, jobName, date, startTimestamp, endTimestamp, hours, breakMinutes, wage, gross, memo
 */

const CSV_HEADERS = ['recordId', 'jobId', 'jobName', 'date', 'startTimestamp', 'endTimestamp', 'hours', 'breakMinutes', 'wage', 'gross', 'memo']

function escapeCSV(val) {
    const str = String(val ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

export function generateCSV(records) {
    const rows = [CSV_HEADERS.join(',')]
    for (const r of records) {
        const gross = r.hours != null && r.wage != null ? (r.hours * r.wage).toFixed(2) : ''
        rows.push([
            r.id, r.jobId, r.jobName, r.date,
            r.startTimestamp, r.endTimestamp,
            Number(r.hours ?? 0).toFixed(2),
            Number(r.breakMinutes ?? 0),
            Number(r.wage ?? 0).toFixed(2),
            gross,
            r.memo ?? ''
        ].map(escapeCSV).join(','))
    }
    // Add UTF-8 BOM so Excel correctly recognizes Chinese characters
    return '\uFEFF' + rows.join('\n')
}

export function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const records = []
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i])
        const obj = {}
        headers.forEach((h, idx) => { obj[h] = cols[idx] ?? '' })
        if (obj.recordId) {
            records.push({
                id: obj.recordId,
                jobId: obj.jobId,
                jobName: obj.jobName,
                date: obj.date,
                startTimestamp: obj.startTimestamp,
                endTimestamp: obj.endTimestamp,
                hours: parseFloat(obj.hours) || 0,
                breakMinutes: parseInt(obj.breakMinutes || '0', 10) || 0,
                wage: parseFloat(obj.wage) || 0,
                memo: obj.memo,
                source: 'import'
            })
        }
    }
    return records
}

function splitCSVLine(line) {
    const cols = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuote) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
            else if (ch === '"') { inQuote = false }
            else { cur += ch }
        } else {
            if (ch === '"') { inQuote = true }
            else if (ch === ',') { cols.push(cur); cur = '' }
            else { cur += ch }
        }
    }
    cols.push(cur)
    return cols
}

export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
