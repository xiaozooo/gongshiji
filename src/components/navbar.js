/**
 * Bottom navigation bar — 3 tabs (Jobs moved to Settings)
 */

const navItems = [
    { route: '#home', icon: '⏱️', label: '记工时' },
    { route: '#history', icon: '📋', label: '历史' },
    { route: '#settings', icon: '⚙️', label: '设置' }
]

export function renderNavbar() {
    const nav = document.getElementById('navbar')
    nav.innerHTML = navItems.map(item => `
    <a href="${item.route}" class="nav-item" data-route="${item.route}" aria-label="${item.label}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>
  `).join('')
}
