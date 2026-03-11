import './index.css'
import { getDB } from './db/database.js'
import { ensureDefaultJob } from './db/jobStore.js'
import { renderNavbar } from './components/navbar.js'
import { register, init } from './router.js'

// Register status bar
function initStatusBar() {
    const bar = document.createElement('div')
    bar.id = 'status-bar'
    bar.className = `status-bar ${navigator.onLine ? 'online' : 'offline'}`
    bar.innerHTML = `<span class="status-dot"></span><span>${navigator.onLine ? '已连接' : '离线模式'}</span>`
    document.getElementById('app').insertBefore(bar, document.getElementById('page-container'))

    window.addEventListener('online', () => {
        bar.className = 'status-bar online'
        bar.innerHTML = ''
    })
    window.addEventListener('offline', () => {
        bar.className = 'status-bar offline'
        bar.innerHTML = `<span class="status-dot"></span><span>离线模式</span>`
    })
}

// Register routes (lazy loaded)
register('#home', () => import('./pages/home.js'))
register('#history', () => import('./pages/history.js'))
register('#settings', () => import('./pages/settings.js'))

async function bootstrap() {
    // init DB
    await getDB()
    // ensure default job exists
    await ensureDefaultJob()
    // render navbar
    renderNavbar()
    // status bar
    initStatusBar()
    // start router
    init()
}

bootstrap().catch(console.error)
