import { getRecordsByDateRange, updateRecord, deleteRecord } from '../db/recordStore.js'
import { getAllJobs } from '../db/jobStore.js'
import { showToast } from '../components/toast.js'
import { showModal, showModalPromise } from '../components/modal.js'
import {
  formatDateShort,
  formatTime,
  formatHours,
  getLocalDate,
  calcMinutes,
  calcNetWorkMinutes,
  toLocalInputValue,
  localInputToISO
} from '../utils/time.js'
import { pickJobColor } from '../utils/colors.js'
import {
  getWeekRange,
  getMonthRange,
  aggregateDaily,
  aggregateJobs,
  summarizeTotals,
  enumerateDates
} from '../utils/historyStats.js'

export function getHistoryHeaderActionsMarkup() {
  return ''
}

function toDateParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(dateStr, delta) {
  const d = toDateParts(dateStr)
  d.setDate(d.getDate() + delta)
  return getLocalDate(d.toISOString())
}

function addMonths(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  d.setMonth(d.getMonth() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtDateRange(start, end) {
  return `${start.replace(/-/g, '.')} - ${end.replace(/-/g, '.')}`
}

function fmtMoney(n) {
  return `¥${Number(n || 0).toFixed(2)}`
}

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  let mode = 'week' // week | month | job
  let weekAnchor = getLocalDate(new Date().toISOString())
  let monthAnchor = getLocalDate(new Date().toISOString()).slice(0, 7)
  let jobPeriod = 'month' // week | month | 30d
  let activeDateFilter = null
  let jobSortBy = 'income' // income | hours | records
  let undoState = null

  async function reload() {
    const jobs = await getAllJobs(true)
    const jobColorMap = Object.fromEntries(jobs.map(j => [j.id, j.color || pickJobColor(j.id)]))
    const range = resolveRange(mode, weekAnchor, monthAnchor, jobPeriod)
    const records = await getRecordsByDateRange(range.start, range.end)

    const summary = summarizeTotals(records)
    const daily = aggregateDaily(records)
    const jobsAgg = aggregateJobs(records)
    const detailRecords = activeDateFilter ? records.filter(r => r.date === activeDateFilter) : records
    const detail = buildDetail(detailRecords)

    page.innerHTML = `
      <div class="page-header">
        <span class="page-title">历史</span>
        ${getHistoryHeaderActionsMarkup()}
      </div>
      <div class="page-content">

        <div class="view-switcher" id="hist-mode-switcher">
          <button class="view-switch-btn${mode === 'week' ? ' active' : ''}" data-mode="week">按周</button>
          <button class="view-switch-btn${mode === 'month' ? ' active' : ''}" data-mode="month">按月</button>
          <button class="view-switch-btn${mode === 'job' ? ' active' : ''}" data-mode="job">按工作</button>
        </div>

        ${renderRangeControl(mode, range, monthAnchor, jobPeriod)}

        ${renderActiveFilters(activeDateFilter)}

        ${renderKPI(summary)}

        ${mode === 'job'
          ? renderJobCharts(jobsAgg, jobColorMap)
          : renderTrendCharts(daily, range.start, range.end)
        }

        ${records.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">当前范围暂无记录</div><a href="#home" class="btn btn-primary" style="margin-top:8px;">去记录</a></div>`
          : mode === 'job'
            ? renderJobSummaryList(jobsAgg, jobColorMap, jobSortBy)
            : renderDailyDetail(detail, jobColorMap)
        }
      </div>
    `

    bindEvents({ records })
  }

  function bindEvents({ records }) {
    page.querySelector('#hist-mode-switcher')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-mode]')
      if (!btn) return
      mode = btn.dataset.mode
      activeDateFilter = null
      reload()
    })

    page.querySelector('#hist-prev')?.addEventListener('click', () => {
      if (mode === 'week') weekAnchor = addDays(weekAnchor, -7)
      if (mode === 'month') monthAnchor = addMonths(monthAnchor, -1)
      reload()
    })
    page.querySelector('#hist-next')?.addEventListener('click', () => {
      if (mode === 'week') weekAnchor = addDays(weekAnchor, 7)
      if (mode === 'month') monthAnchor = addMonths(monthAnchor, 1)
      reload()
    })

    page.querySelector('#hist-job-period')?.addEventListener('change', e => {
      jobPeriod = e.target.value
      activeDateFilter = null
      reload()
    })

    page.querySelectorAll('[data-chart-date]').forEach(btn => {
      btn.onclick = () => {
        const d = btn.dataset.chartDate
        activeDateFilter = activeDateFilter === d ? null : d
        reload()
      }
    })

    page.querySelectorAll('[data-job-sort]').forEach(btn => {
      btn.onclick = () => {
        jobSortBy = btn.dataset.jobSort
        reload()
      }
    })

    page.querySelector('#hist-clear-date-filter')?.addEventListener('click', () => {
      activeDateFilter = null
      reload()
    })

    page.querySelectorAll('[data-rec-open]').forEach(el => {
      const rec = records.find(r => r.id === el.dataset.recOpen)
      if (!rec) return
      bindRecordLongPress(el, rec, reload)
    })

  }

  async function openRecordActions(rec, reload) {
    const choice = await showModalPromise({
      title: rec.jobName,
      description: `${formatTime(rec.startTimestamp)} - ${formatTime(rec.endTimestamp)}`,
      options: [
        { label: '编辑', value: 'edit', type: 'primary' },
        { label: '删除', value: 'delete', type: 'danger' },
        { label: '取消', value: 'cancel', type: 'ghost' }
      ]
    })
    if (choice === 'edit') showEditModal(rec, reload)
    if (choice === 'delete') await deleteWithUndo(rec, reload)
  }

  async function deleteWithUndo(rec, reload) {
    await deleteRecord(rec.id)
    showUndoBar({
      text: `已删除：${rec.jobName}`,
      onUndo: async () => {
        await updateRecord(rec.id, { isDeleted: false })
        showToast('已撤销删除')
        reload()
      },
      onDone: () => reload()
    })
  }

  function showUndoBar({ text, onUndo, onDone }) {
    if (undoState?.timer) clearTimeout(undoState.timer)
    if (undoState?.el) undoState.el.remove()

    const bar = document.createElement('div')
    bar.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:1200;background:#111827;color:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:center;max-width:92vw;box-shadow:0 10px 30px rgba(0,0,0,.25);'
    bar.innerHTML = `<span style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60vw;">${text}</span><button class="btn btn-ghost btn-sm" id="hist-undo-btn" style="color:#93c5fd;border-color:#374151;">撤销</button>`
    document.body.appendChild(bar)

    const timer = setTimeout(() => {
      bar.remove()
      undoState = null
      onDone?.()
    }, 5000)

    undoState = { timer, el: bar }
    bar.querySelector('#hist-undo-btn')?.addEventListener('click', async () => {
      clearTimeout(timer)
      bar.remove()
      undoState = null
      await onUndo?.()
    })
  }

  function bindRecordLongPress(contentEl, rec, reload) {
    let startX = 0
    let startY = 0
    let moved = false
    let longPressTimer = null
    let longPressed = false

    function onStart(e) {
      const p = e.touches ? e.touches[0] : e
      startX = p.clientX
      startY = p.clientY
      moved = false
      longPressed = false
      longPressTimer = setTimeout(async () => {
        longPressed = true
        await openRecordActions(rec, reload)
      }, 450)
    }

    function onMove(e) {
      const p = e.touches ? e.touches[0] : e
      const mx = p.clientX - startX
      const my = p.clientY - startY
      if (Math.abs(mx) > 8 || Math.abs(my) > 8) moved = true
      if (moved && longPressTimer) clearTimeout(longPressTimer)
    }

    function onEnd() {
      if (longPressTimer) clearTimeout(longPressTimer)
      if (longPressed) return
      // 单击不触发任何操作；仅长按触发操作菜单
    }

    contentEl.addEventListener('touchstart', onStart, { passive: true })
    contentEl.addEventListener('touchmove', onMove, { passive: true })
    contentEl.addEventListener('touchend', onEnd)
    contentEl.addEventListener('mousedown', onStart)
    contentEl.addEventListener('mousemove', onMove)
    contentEl.addEventListener('mouseup', onEnd)
    contentEl.addEventListener('mouseleave', onEnd)
  }

  await reload()
  return page
}

function resolveRange(mode, weekAnchor, monthAnchor, jobPeriod) {
  if (mode === 'week') return getWeekRange(weekAnchor)
  if (mode === 'month') return getMonthRange(monthAnchor)

  const today = getLocalDate(new Date().toISOString())
  if (jobPeriod === 'week') return getWeekRange(today)
  if (jobPeriod === 'month') return getMonthRange(today.slice(0, 7))
  return { start: addDays(today, -29), end: today }
}

function renderRangeControl(mode, range, monthAnchor, jobPeriod) {
  if (mode === 'week') {
    return `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:var(--space-3);">
        <button class="btn btn-ghost btn-sm" id="hist-prev">‹ 上一周</button>
        <div style="font-size:13px;font-weight:600;">${fmtDateRange(range.start, range.end)}</div>
        <button class="btn btn-ghost btn-sm" id="hist-next">下一周 ›</button>
      </div>
    `
  }
  if (mode === 'month') {
    return `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:var(--space-3);">
        <button class="btn btn-ghost btn-sm" id="hist-prev">‹ 上一月</button>
        <div style="font-size:13px;font-weight:600;">${monthAnchor.replace('-', '年')}月</div>
        <button class="btn btn-ghost btn-sm" id="hist-next">下一月 ›</button>
      </div>
    `
  }
  return `
    <div class="card" style="display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:var(--space-3);">
      <label class="form-label" style="margin-bottom:0;">汇总范围</label>
      <select class="form-select" id="hist-job-period" style="flex:1;">
        <option value="week"${jobPeriod === 'week' ? ' selected' : ''}>本周</option>
        <option value="month"${jobPeriod === 'month' ? ' selected' : ''}>本月</option>
        <option value="30d"${jobPeriod === '30d' ? ' selected' : ''}>近30天</option>
      </select>
      <span style="font-size:12px;color:var(--color-text-muted);">${fmtDateRange(range.start, range.end)}</span>
    </div>
  `
}

function renderKPI(summary) {
  return `
    <div class="stats-grid" style="margin-bottom:var(--space-3);">
      <div class="stat-card stat-primary"><div class="stat-label">总工时</div><div class="stat-value">${formatHours(summary.totalHours)}h</div><div class="stat-sub">${summary.recordCount} 条记录</div></div>
      <div class="stat-card stat-accent"><div class="stat-label">总收入</div><div class="stat-value" style="font-size:20px;">${fmtMoney(summary.totalIncome)}</div><div class="stat-sub">按记录工价</div></div>
      <div class="stat-card"><div class="stat-label">出勤天数</div><div class="stat-value">${summary.workedDays}</div><div class="stat-sub">天</div></div>
      <div class="stat-card"><div class="stat-label">平均时薪</div><div class="stat-value">${fmtMoney(summary.avgHourly)}</div><div class="stat-sub">加权平均</div></div>
    </div>
  `
}

function renderActiveFilters(activeDateFilter) {
  if (!activeDateFilter) return ''
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:var(--space-3);">
      ${activeDateFilter ? `<span class="badge badge-primary">日期: ${activeDateFilter} <button class="btn btn-ghost btn-sm" id="hist-clear-date-filter" style="margin-left:4px;padding:0 4px;">×</button></span>` : ''}
    </div>
  `
}

function renderTrendCharts(daily, start, end) {
  const dates = enumerateDates(start, end)
  const index = new Map(daily.map(d => [d.date, d]))
  const points = dates.map(d => index.get(d) || { date: d, hours: 0, income: 0 })
  const maxHours = Math.max(1, ...points.map(p => p.hours))
  const maxIncome = Math.max(1, ...points.map(p => p.income))

  const bars = points.map(p => {
    const h = Math.max(4, Math.round((p.hours / maxHours) * 72))
    return `<button class="btn btn-ghost btn-sm" data-chart-date="${p.date}" style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:24px;padding:0 2px;">
      <div title="${p.date} · ${formatHours(p.hours)}h" style="width:16px;height:${h}px;background:var(--color-primary);border-radius:4px 4px 0 0;"></div>
      <div style="font-size:11px;color:var(--color-text-muted);">${Number(p.date.slice(-2))}</div>
    </button>`
  }).join('')

  const linePts = points.map((p, i) => {
    const x = points.length <= 1 ? 0 : (i / (points.length - 1)) * 100
    const y = 100 - (p.income / maxIncome) * 100
    return `${x},${y}`
  }).join(' ')

  return `
    <div class="card" style="margin-bottom:var(--space-3);">
      <div style="font-weight:600;margin-bottom:8px;">工时趋势</div>
      <div style="display:flex;align-items:flex-end;gap:8px;overflow:auto;padding-bottom:4px;">${bars}</div>
    </div>
    <div class="card" style="margin-bottom:var(--space-4);">
      <div style="font-weight:600;margin-bottom:8px;">收入趋势</div>
      <div style="height:100px;position:relative;background:var(--color-surface);border-radius:8px;padding:6px;">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;">
          <polyline fill="none" stroke="var(--color-accent)" stroke-width="2" points="${linePts}" />
        </svg>
      </div>
    </div>
  `
}

function renderJobCharts(jobsAgg, jobColorMap) {
  const byHours = [...jobsAgg].sort((a, b) => b.hours - a.hours)
  const byIncome = [...jobsAgg].sort((a, b) => b.income - a.income)
  const maxHours = Math.max(1, ...byHours.map(j => j.hours), 1)
  const maxIncome = Math.max(1, ...byIncome.map(j => j.income), 1)

  return `
    <div class="card" style="margin-bottom:var(--space-3);">
      <div style="font-weight:600;margin-bottom:8px;">工作工时对比</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${byHours.map(j => {
          const w = Math.max(2, Math.round((j.hours / maxHours) * 100))
          const c = jobColorMap[j.jobId] || 'var(--color-primary)'
          return `<div><div style="font-size:12px;display:flex;justify-content:space-between;"><span>${j.jobName}</span><span>${formatHours(j.hours)}h</span></div><div style="height:8px;background:var(--color-surface);border-radius:999px;"><div style="height:8px;width:${w}%;background:${c};border-radius:999px;"></div></div></div>`
        }).join('')}
      </div>
    </div>
    <div class="card" style="margin-bottom:var(--space-4);">
      <div style="font-weight:600;margin-bottom:8px;">工作收入对比</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${byIncome.map(j => {
          const w = Math.max(2, Math.round((j.income / maxIncome) * 100))
          const c = jobColorMap[j.jobId] || 'var(--color-accent)'
          return `<div><div style="font-size:12px;display:flex;justify-content:space-between;"><span>${j.jobName}</span><span>${fmtMoney(j.income)}</span></div><div style="height:8px;background:var(--color-surface);border-radius:999px;"><div style="height:8px;width:${w}%;background:${c};border-radius:999px;"></div></div></div>`
        }).join('')}
      </div>
    </div>
  `
}

function buildDetail(records) {
  const map = {}
  for (const r of records) {
    if (!map[r.date]) map[r.date] = []
    map[r.date].push(r)
  }
  const dates = Object.keys(map).sort((a, b) => b.localeCompare(a))
  return dates.map(date => ({ date, records: map[date].sort((a, b) => new Date(a.startTimestamp) - new Date(b.startTimestamp)) }))
}

function renderDailyDetail(groups, jobColorMap) {
  return `
    <div id="hist-list">
      ${groups.map(g => {
        const dayH = g.records.reduce((s, r) => s + Number(r.hours || 0), 0)
        const dayI = g.records.reduce((s, r) => s + Number(r.hours || 0) * Number(r.wage || 0), 0)
        return `<div class="record-day-group">
          <div class="record-day-header">
            <span class="record-day-label">${formatDateShort(g.date)}</span>
            <span class="record-day-total">${formatHours(dayH)}h · ${fmtMoney(dayI)}</span>
          </div>
          ${g.records.map(r => {
            const dot = jobColorMap[r.jobId] || 'var(--color-primary)'
            return `<div class="record-item" data-rec-open="${r.id}" style="margin-bottom:8px;">
              <div class="record-item-info">
                <div class="record-item-job"><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${dot};margin-right:6px;"></span>${r.jobName} · ${formatHours(r.hours)}h · ${fmtMoney(Number(r.hours || 0) * Number(r.wage || 0))}</div>
                <div class="record-item-time">${formatTime(r.startTimestamp)} - ${formatTime(r.endTimestamp)}${(r.breakMinutes || 0) > 0 ? ` · 休息${r.breakMinutes}分钟` : ''}${r.memo ? ` · ${r.memo}` : ''}</div>
              </div>
            </div>`
          }).join('')}
        </div>`
      }).join('')}
    </div>
  `
}

function renderJobSummaryList(jobsAgg, jobColorMap, sortBy = 'income') {
  const ordered = [...jobsAgg].sort((a, b) => {
    if (sortBy === 'hours') return b.hours - a.hours
    if (sortBy === 'records') return b.records - a.records
    return b.income - a.income
  })
  return `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="view-switcher">
        <button class="view-switch-btn${sortBy === 'income' ? ' active' : ''}" data-job-sort="income">按收入</button>
        <button class="view-switch-btn${sortBy === 'hours' ? ' active' : ''}" data-job-sort="hours">按工时</button>
        <button class="view-switch-btn${sortBy === 'records' ? ' active' : ''}" data-job-sort="records">按记录数</button>
      </div>
      ${ordered.map(j => {
        const c = jobColorMap[j.jobId] || 'var(--color-primary)'
        return `<div class="card-white" style="padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="font-weight:600;"><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${c};margin-right:6px;"></span>${j.jobName}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;font-size:13px;color:var(--color-text-secondary);">
            <div>工时：${formatHours(j.hours)}h</div>
            <div>收入：${fmtMoney(j.income)}</div>
            <div>记录：${j.records} 条</div>
            <div>出勤：${j.workedDays} 天</div>
          </div>
        </div>`
      }).join('')}
    </div>
  `
}

function showEditModal(rec, onSaved) {
  const startVal = toLocalInputValue(rec.startTimestamp)
  const endVal = toLocalInputValue(rec.endTimestamp)
  showModal({
    title: '编辑记录',
    content: `
      <div class="form-group">
        <label class="form-label">工作</label>
        <input class="form-input" value="${rec.jobName}" disabled />
      </div>
      <div class="form-group">
        <label class="form-label">开始时间</label>
        <input class="form-input" id="er-start" type="datetime-local" step="600" value="${startVal}" />
      </div>
      <div class="form-group">
        <label class="form-label">结束时间</label>
        <input class="form-input" id="er-end" type="datetime-local" step="600" value="${endVal}" />
      </div>
      <div class="form-group">
        <label class="form-label">休息时长（分钟）</label>
        <input class="form-input" id="er-break" type="number" inputmode="numeric" min="0" step="10" value="${rec.breakMinutes || 0}" />
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <input class="form-input" id="er-memo" type="text" value="${rec.memo || ''}" />
      </div>
    `,
    buttons: [
      {
        label: '保存', id: 'er-save', type: 'primary',
        onClick: async () => {
          const newStart = localInputToISO(document.getElementById('er-start').value)
          const newEnd = localInputToISO(document.getElementById('er-end').value)
          const breakMinutes = Math.max(0, parseInt(document.getElementById('er-break').value || '0', 10) || 0)
          const memo = document.getElementById('er-memo').value
          if (new Date(newEnd) <= new Date(newStart)) { showToast('结束时间须晚于开始时间', 'error'); return }
          const totalMinutes = calcMinutes(newStart, newEnd)
          if (breakMinutes >= totalMinutes) { showToast('休息时长必须小于总时长', 'error'); return }
          const workMinutes = calcNetWorkMinutes(totalMinutes, breakMinutes)
          await updateRecord(rec.id, {
            startTimestamp: newStart,
            endTimestamp: newEnd,
            breakMinutes,
            hours: Math.round((workMinutes / 60) * 100) / 100,
            date: getLocalDate(newStart),
            yearMonth: getLocalDate(newStart).slice(0, 7),
            memo
          })
          showToast('记录已更新')
          onSaved()
        }
      },
      { label: '取消', id: 'er-cancel', type: 'ghost', onClick: () => { } }
    ]
  })
}
