import { getAllRecords, bulkImportRecords } from '../db/recordStore.js'
import { setMeta } from '../db/database.js'
import { showToast } from '../components/toast.js'
import { showModalPromise } from '../components/modal.js'
import { renderJobsPanel } from '../components/jobsPanel.js'
import { generateCSV, parseCSV, downloadFile } from '../utils/csv.js'
import { detectConflicts, summarizeConflicts } from '../utils/conflict.js'

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  page.innerHTML = `
    <div class="page-header">
      <span class="page-title">设置</span>
    </div>
    <div class="page-content">

      <!-- ── 工作管理 ── -->
      <div id="jobs-panel-host"></div>

      <div class="divider"></div>

      <!-- ── 导出 ── -->
      <div class="section-header"><span class="section-title">导出数据</span></div>
      <div class="settings-list mb-4">
        <div class="settings-item" id="s-csv">
          <div class="settings-item-icon">📊</div>
          <div class="settings-item-info">
            <div class="settings-item-title">导出 CSV</div>
            <div class="settings-item-desc">工资表 / Excel 格式</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>

      <!-- ── 导入 ── -->
      <div class="section-header"><span class="section-title">导入数据</span></div>
      <div class="settings-list mb-4">
        <div class="settings-item" id="s-import-csv">
          <div class="settings-item-icon">📑</div>
          <div class="settings-item-info">
            <div class="settings-item-title">导入 CSV 记录</div>
            <div class="settings-item-desc">从 CSV 文件导入</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>

      <!-- ── 安装 ── -->
      <div class="section-header"><span class="section-title">安装应用</span></div>
      <div class="card mb-4" style="font-size:14px;line-height:1.8;color:var(--color-text-secondary);">
        <strong>iPhone / iPad：</strong>Safari → 底部分享按钮（□↑）→ 添加到主屏幕<br/>
        <strong>Android / 桌面：</strong>浏览器地址栏右侧安装图标，点击即可
      </div>

      <div class="card mb-4" style="border-color:#fcd34d;background:#fffbeb;font-size:14px;line-height:1.7;color:#92400e;">
        ⚠️ <strong>iOS 用户：</strong>Safari 长期不访问可能清除本地数据，建议每周导出一次备份。
      </div>

      <!-- ── 危险 ── -->
      <div class="section-header"><span class="section-title">危险操作</span></div>
      <div class="settings-list">
        <div class="settings-item" id="s-clear" style="border-color:#fecaca;background:#fef2f2;">
          <div class="settings-item-icon" style="background:#fee2e2;">🗑️</div>
          <div class="settings-item-info">
            <div class="settings-item-title" style="color:var(--color-danger);">清除所有数据</div>
            <div class="settings-item-desc">不可恢复，请先备份</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>

    </div>
  `

  // ── Mount jobs panel ──
  await renderJobsPanel(page.querySelector('#jobs-panel-host'))

  // ── Export CSV ──
  page.querySelector('#s-csv').onclick = async () => {
    const records = await getAllRecords()
    if (!records.length) { showToast('没有可导出的记录', 'warning'); return }
    downloadFile(generateCSV(records), `工时记_${today()}.csv`, 'text/csv;charset=utf-8')
    await setMeta('lastBackupAt', new Date().toISOString())
    showToast(`已导出 ${records.length} 条记录`)
  }

  // ── Import CSV ──
  page.querySelector('#s-import-csv').onclick = () => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.csv' })
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return
      const records = parseCSV(await file.text())
      if (!records.length) { showToast('CSV 文件为空或格式不正确', 'error'); return }
      await runImport(records, null)
    }
    inp.click()
  }

  async function runImport(incoming, jobs) {
    const existing = await getAllRecords()
    const conflicts = detectConflicts(existing, incoming)
    const s = summarizeConflicts(conflicts)
    const choice = await showModalPromise({
      title: '导入预览',
      description: `共 ${incoming.length} 条：新增 ${s.new}，冲突 ${s.id_conflict + s.likely_duplicate}`,
      options: [
        { label: '追加（保留已有）', value: 'append', type: 'accent' },
        { label: '覆盖冲突记录', value: 'overwrite', type: 'warning' },
        { label: '取消', value: 'cancel', type: 'ghost' }
      ]
    })
    if (choice === 'cancel') return
    const result = await bulkImportRecords(incoming, jobs, choice)
    showToast(`导入完成：新增 ${result.added}，更新 ${result.updated}，跳过 ${result.skipped}`)
  }

  // ── Clear data ──
  page.querySelector('#s-clear').onclick = async () => {
    const choice = await showModalPromise({
      title: '⚠️ 清除所有数据',
      description: '此操作不可恢复！所有工作和记录将被删除。请确认已导出备份。',
      options: [
        { label: '确认清除', value: 'ok', type: 'danger' },
        { label: '取消', value: 'cancel', type: 'ghost' }
      ]
    })
    if (choice !== 'ok') return
    const { getDB } = await import('../db/database.js')
    const db = await getDB()
    await db.clear('records'); await db.clear('jobs')
    showToast('所有数据已清除', 'warning')
    await renderJobsPanel(page.querySelector('#jobs-panel-host'))
  }

  return page
}

function today() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
