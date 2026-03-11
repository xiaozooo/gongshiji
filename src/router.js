/**
 * Simple hash-based SPA router
 */

const routes = {}
let currentRoute = null

export function register(hash, loader) {
    routes[hash] = loader
}

export async function navigate(hash) {
    const target = hash || '#home'
    // update nav highlighting
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.route === target)
    })

    const loader = routes[target]
    if (!loader) {
        console.warn('No route for', target)
        return
    }

    const container = document.getElementById('page-container')
    container.innerHTML = ''
    try {
        const { render } = await loader()
        const el = await render()
        container.appendChild(el)
        container.scrollTop = 0
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">加载失败</div><div class="empty-desc">${e.message}</div></div>`
    }
    currentRoute = target
}

export function init() {
    window.addEventListener('hashchange', () => navigate(window.location.hash || '#home'))
    navigate(window.location.hash || '#home')
}

export function getCurrentRoute() {
    return currentRoute
}
