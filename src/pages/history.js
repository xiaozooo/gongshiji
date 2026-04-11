import { getRecordsByDateRange, updateRecord, deleteRecord, getOverlappingRecords } from '../db/recordStore.js'
import { getAllJobs } from '../db/jobStore.js'
import { showToast } from '../components/toast.js'
import { showModal, showModalPromise } from '../components/modal.js'
import {
  formatDateShort,
  formatTime,
  formatHours,
  getLocalDate,
  getYearMonth,
  calcMinutes,
  calcNetWorkMinutes,
  localDateTimeToISO
} from '../utils/time.js'
import { pickJobColor } from '../utils/colors.js'
import { getWagePlaceholder, getWageInputValueForEdit } from '../utils/wage.js'
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

export const HISTORY_RECORD_ACTION_TRIGGER = 'click'
let ChartCtorPromise = null

async function getChartCtor() {
  if (!ChartCtorPromise) {
    ChartCtorPromise = import('chart.js/auto').then(mod => mod.default || mod.Chart || mod)
  }
  return ChartCtorPromise
}

function toDateParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toTimeValue(timestamp) {
  const d = new Date(timestamp)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  let trendChart = null

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
    const trendPoints = mode === 'job' ? [] : buildTrendPoints(daily, range.start, range.end)

    if (trendChart) {
      trendChart.destroy()
      trendChart = null
    }

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
          : renderTrendChartCard(trendPoints)
        }

        ${records.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">当前范围暂无记录</div><a href="#home" class="btn btn-primary" style="margin-top:8px;">去记录</a></div>`
          : mode === 'job'
            ? renderJobSummaryList(jobsAgg, jobColorMap, jobSortBy)
            : renderDailyDetail(detail, jobColorMap)
        }
      </div>
    `

    bindEvents({ records, jobs })
    if (mode !== 'job') {
      trendChart = await mountTrendChart({
        page,
        points: trendPoints,
        activeDateFilter,
        onPickDate: date => {
          activeDateFilter = activeDateFilter === date ? null : date
          reload()
        }
      })
    }
  }

  function bindEvents({ records, jobs }) {
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
      el.addEventListener(HISTORY_RECORD_ACTION_TRIGGER, () => {
        openRecordActions(rec, jobs, reload)
      })
    })

  }

  async function openRecordActions(rec, jobs, reload) {
    const choice = await showModalPromise({
      title: rec.jobName,
      description: `${formatTime(rec.startTimestamp)} - ${formatTime(rec.endTimestamp)}`,
      options: [
        { label: '编辑', value: 'edit', type: 'primary' },
        { label: '删除', value: 'delete', type: 'danger' },
        { label: '取消', value: 'cancel', type: 'ghost' }
      ]
    })
    if (choice === 'edit') showEditModal(rec, jobs, reload)
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
      <div class="stat-card stat-primary"><div class="stat-label">总工时</div><div class="stat-value" style="font-size:32px;font-family:var(--font-family-display);">${formatHours(summary.totalHours)}<span style="font-size:20px;font-family:var(--font-family);">h</span></div><div class="stat-sub">${summary.recordCount} 条记录</div></div>
      <div class="stat-card stat-accent"><div class="stat-label">总收入</div><div class="stat-value" style="font-size:26px;font-family:var(--font-family-display);">${fmtMoney(summary.totalIncome)}</div><div class="stat-sub">按记录工价</div></div>
      <div class="stat-card"><div class="stat-label">出勤天数</div><div class="stat-value" style="font-size:32px;font-family:var(--font-family-display);">${summary.workedDays}</div><div class="stat-sub">天</div></div>
      <div class="stat-card"><div class="stat-label">平均时薪</div><div class="stat-value" style="font-size:24px;font-family:var(--font-family-display);">${fmtMoney(summary.avgHourly)}</div><div class="stat-sub">加权平均</div></div>
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

function buildTrendPoints(daily, start, end) {
  const dates = enumerateDates(start, end)
  const index = new Map(daily.map(d => [d.date, d]))
  return dates.map(d => {
    const item = index.get(d)
    return {
      date: d,
      dayLabel: String(Number(d.slice(-2))),
      hours: Number(item?.hours || 0),
      income: Number(item?.income || 0)
    }
  })
}

function renderTrendChartCard(points) {
  const hasValue = points.some(p => p.hours > 0 || p.income > 0)
  return `
    <div class="hist-trend-card">
      <div class="hist-trend-head">
        <div class="hist-trend-title">趋势概览</div>
        <div class="hist-trend-sub">柱：工时（h） · 线：收入（¥）</div>
      </div>
      <div class="hist-trend-canvas chartjs">
        <canvas id="hist-trend-canvas" aria-label="工时与收入趋势图"></canvas>
        ${!hasValue ? `<div class="hist-trend-empty">当前范围暂无趋势波动</div>` : ''}
      </div>
      <div class="hist-trend-axis">
        <span>${Number(points[0]?.date?.slice(-2) || 0)}</span>
        <span>${Number(points[points.length - 1]?.date?.slice(-2) || 0)}</span>
      </div>
    </div>
  `
}

export function buildHistoryChartDatasets(points, activeDateFilter = null) {
  return [
    {
      type: 'bar',
      label: '工时',
      yAxisID: 'yHours',
      data: points.map(p => p.hours),
      backgroundColor: points.map(p => p.date === activeDateFilter ? 'rgba(37,99,235,0.55)' : 'rgba(37,99,235,0.32)'),
      borderColor: points.map(p => p.date === activeDateFilter ? '#1d4ed8' : '#2563eb'),
      borderWidth: points.map(p => p.date === activeDateFilter ? 1.2 : 1),
      borderRadius: 3,
      barPercentage: 0.64,
      categoryPercentage: 0.86,
      order: 2
    },
    {
      type: 'line',
      label: '收入',
      yAxisID: 'yIncome',
      data: points.map(p => p.income),
      borderColor: '#ea580c',
      borderWidth: 1.8,
      tension: 0.28,
      fill: false,
      pointRadius: points.map(p => p.date === activeDateFilter ? 4 : 0),
      pointHoverRadius: 4,
      pointBackgroundColor: '#ea580c',
      pointBorderColor: '#fff',
      pointBorderWidth: 1.5,
      order: 1
    }
  ]
}

export function buildHistoryChartOptions(points, activeDateFilter = null) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 180 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'start',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: '#6b7280',
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            if (ctx.dataset.yAxisID === 'yHours') return `工时 ${Number(ctx.parsed.y || 0).toFixed(2)}h`
            return `收入 ¥${Number(ctx.parsed.y || 0).toFixed(2)}`
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#6b7280',
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
          callback: (value, index) => {
            if (index === 0 || index === points.length - 1) return points[index]?.dayLabel || ''
            const span = points.length > 20 ? 5 : 3
            return index % span === 0 ? points[index]?.dayLabel || '' : ''
          }
        }
      },
      yHours: {
        position: 'left',
        beginAtZero: true,
        grid: {
          color: '#e5e7eb',
          lineWidth: 0.8,
          drawTicks: false
        },
        ticks: {
          color: '#64748b',
          callback: v => `${v}h`
        }
      },
      yIncome: {
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: {
          color: '#9a3412',
          callback: v => `¥${v}`
        }
      }
    },
    activeDateFilter
  }
}

async function mountTrendChart({ page, points, activeDateFilter, onPickDate }) {
  const canvas = page.querySelector('#hist-trend-canvas')
  if (!canvas || points.length === 0) return null

  const ChartCtor = await getChartCtor()
  const datasets = buildHistoryChartDatasets(points, activeDateFilter)
  const options = buildHistoryChartOptions(points, activeDateFilter)
  options.onClick = (evt, _els, chart) => {
    const hits = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true)
    if (!hits.length) return
    const date = points[hits[0].index]?.date
    if (date) onPickDate(date)
  }

  return new ChartCtor(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: points.map(p => p.dayLabel),
      datasets
    },
    options
  })
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

export function buildHistoryEditModalContent({ rec, dateValue, startTimeValue, endTimeValue, wagePlaceholder, wageValue }) {
  const breakValue = Number(rec.breakMinutes || 0)
  return `
    <div class="form-group">
      <label class="form-label">工作</label>
      <input class="form-input" value="${rec.jobName}" disabled />
    </div>
    <div class="form-group">
      <label class="form-label">日期</label>
      <input class="form-input" id="er-date" type="date" value="${dateValue}" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
      <div class="form-group">
        <label class="form-label">开始时间</label>
        <input class="form-input" id="er-start" type="time" step="600" value="${startTimeValue}" />
      </div>
      <div class="form-group">
        <label class="form-label">结束时间</label>
        <input class="form-input" id="er-end" type="time" step="600" value="${endTimeValue}" />
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
      <div class="form-group">
        <label class="form-label">休息时长（可选）</label>
        <input class="form-input" id="er-break" type="number" inputmode="numeric" min="0" step="10" value="${breakValue}" placeholder="分钟" />
      </div>
      <div class="form-group">
        <label class="form-label">工价（可选）</label>
        <input class="form-input" id="er-wage" type="number" inputmode="decimal" min="0" step="0.5" value="${wageValue}" placeholder="${wagePlaceholder}" />
      </div>
    </div>
  `
}

function showEditModal(rec, jobs, onSaved) {
  const job = jobs.find(item => item.id === rec.jobId)
  const dateValue = getLocalDate(rec.startTimestamp)
  const startTimeValue = toTimeValue(rec.startTimestamp)
  const endTimeValue = toTimeValue(rec.endTimestamp)
  const wagePlaceholder = getWagePlaceholder(job)
  const wageValue = getWageInputValueForEdit(rec.wage, job?.wage)
  showModal({
    title: '编辑记录',
    content: buildHistoryEditModalContent({ rec, dateValue, startTimeValue, endTimeValue, wagePlaceholder, wageValue }),
    buttons: [
      {
        label: '保存', id: 'er-save', type: 'primary',
        onClick: async () => {
          const dateIn = document.getElementById('er-date').value
          const startIn = document.getElementById('er-start').value
          const endIn = document.getElementById('er-end').value
          const breakMinutes = Math.max(0, parseInt(document.getElementById('er-break').value || '0', 10) || 0)
          const wageRaw = document.getElementById('er-wage').value.trim()
          if (!dateIn || !startIn || !endIn) { showToast('请完整填写日期与时间', 'error'); return }
          if (endIn <= startIn) { showToast('结束时间须晚于开始时间', 'error'); return }
          const newStart = localDateTimeToISO(dateIn, startIn)
          const newEnd = localDateTimeToISO(dateIn, endIn)
          const totalMinutes = calcMinutes(newStart, newEnd)
          if (breakMinutes >= totalMinutes) { showToast('休息时长必须小于总时长', 'error'); return }
          const customWage = wageRaw === '' ? NaN : Number(wageRaw)
          if (wageRaw !== '' && (!Number.isFinite(customWage) || customWage < 0)) {
            showToast('工价必须是大于等于0的数字', 'error')
            return
          }
          const fallbackWage = Number.isFinite(Number(job?.wage)) ? Number(job.wage) : Number(rec.wage || 0)
          const wage = Number.isFinite(customWage) ? customWage : fallbackWage
          const overlapping = await getOverlappingRecords(newStart, newEnd, rec.id)
          if (overlapping.length > 0) {
            const choice = await showModalPromise({
              title: '检测到时间重叠',
              description: `与已有 ${overlapping.length} 条记录时间重叠。`,
              options: [
                { label: '允许重叠继续保存', value: 'allow', type: 'warning' },
                { label: '取消', value: 'cancel', type: 'ghost' }
              ]
            })
            if (choice === 'cancel') return
          }
          const workMinutes = calcNetWorkMinutes(totalMinutes, breakMinutes)
          await updateRecord(rec.id, {
            startTimestamp: newStart,
            endTimestamp: newEnd,
            wage,
            breakMinutes,
            hours: Math.round((workMinutes / 60) * 100) / 100,
            date: getLocalDate(newStart),
            yearMonth: getYearMonth(newStart)
          })
          showToast('记录已更新')
          onSaved()
        }
      },
      { label: '取消', id: 'er-cancel', type: 'ghost', onClick: () => { } }
    ]
  })
}
