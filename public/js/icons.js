/* Iconos SVG en línea. Uso: <span data-icon="nombre"></span> */
(function () {
  'use strict';
  const P = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="4"/><path d="M12 4v4M9 13v1M15 13v1M9 17h6"/><circle cx="12" cy="3.5" r="1"/>',
    shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 2-2.5 3-4 3s-3-1-4-3z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1"/>',
    exit: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4.2 1.8 4.5 5"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    sabotage: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    vent: '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 7v11M11 7v11M15 7v11M19 7v11"/>',
    kill: '<path d="M14.5 3.5l6 6-9.5 9.5-3-3z"/><path d="M8 16l-3.5 3.5M5.5 14.5l4 4"/>',
    report: '<path d="M3 10v4h3l7 5V5L6 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    use: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10M12 9.5V4a1.5 1.5 0 0 1 3 0v6M15 9.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 0 1 2.5-1.6L9 13"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    send: '<path d="M4 12l16-8-6 16-3-6z"/><path d="M11 14l9-10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    lights: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    reactor: '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
    o2: '<circle cx="8" cy="14" r="4.5"/><circle cx="16.5" cy="8" r="3"/><circle cx="17" cy="16.5" r="2"/>',
    door: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M9.5 12h.5M14 12h.5"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2.5 19h19l-2-4h-15z"/>',
    megaphone: '<path d="M3 10v4h3l7 5V5L6 10z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5c1 1.5 2.4 2.2 4 2.2s3-.7 4-2.2"/><path d="M9 9.5v.5M15 9.5v.5"/>',
    camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/>',
    skull: '<path d="M5 11a7 7 0 1 1 14 0c0 2.5-1 4-2.5 5v3h-9v-3C6 15 5 13.5 5 11z"/><circle cx="9.5" cy="11" r="1.6"/><circle cx="14.5" cy="11" r="1.6"/>',
  };
  function svg(name) {
    const p = P[name];
    if (!p) return '';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconDone) return;
      el.innerHTML = svg(el.dataset.icon) + el.innerHTML;
      el.dataset.iconDone = '1';
    });
  }
  window.Icons = { svg, hydrate };
  document.addEventListener('DOMContentLoaded', () => hydrate());
})();
