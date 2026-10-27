/**
 * Bina app PWA ke folder docs/ (untuk GitHub Pages).
 *   docs/          -> app ibu bapa
 *   docs/admin/    -> app admin
 * Guna: node dev/build-web.js
 * Nota: docs/config.js TIDAK ditulis ganti jika sudah wujud (simpan URL API anda).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'apps-script');
const web = path.join(root, 'web');
const out = path.join(root, 'docs');
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
const inline = (html) => html.replace(/<\?!= include\('(\w+)'\); \?>/g, (_, n) => read(n + '.html'));

function pwaHead(base, manifest, title) {
  return [
    `<title>${title}</title>`,
    `<link rel="manifest" href="${manifest}">`,
    '<meta name="theme-color" content="#09090A">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    `<meta name="apple-mobile-web-app-title" content="${title}">`,
    `<link rel="icon" type="image/png" sizes="192x192" href="${base}icons/icon-192.png">`,
    `<link rel="apple-touch-icon" href="${base}icons/apple-touch-icon.png">`,
    `<meta name="sy-sw" content="${base}sw.js">`,
    `<script src="${base}config.js"></script>`,
    `<script src="${base}pwa.js"></script>`,
    // Elak kandungan tersorok di bawah "notch" bila dibuka penuh skrin
    '<style>@media (display-mode: standalone){body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}</style>'
  ].join('\n    ');
}

function manifest(name, short, iconBase) {
  return JSON.stringify({
    name, short_name: short, start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
    background_color: '#09090A', theme_color: '#09090A', lang: 'ms',
    icons: [
      { src: iconBase + 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: iconBase + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: iconBase + 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, null, 2);
}

fs.mkdirSync(path.join(out, 'admin'), { recursive: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });

// Admin
let admin = inline(read('Admin.html'))
  .replace('<?!= bootJson ?>', JSON.stringify({ namaSistem: 'Sistem Yuran', logoUrl: '' }))
  .replace('<base target="_top">', pwaHead('../', 'manifest.webmanifest', 'Yuran Admin'));
if (/<\?/.test(admin)) throw new Error('Scriptlet tertinggal dalam admin');
fs.writeFileSync(path.join(out, 'admin', 'index.html'), admin);
fs.writeFileSync(path.join(out, 'admin', 'manifest.webmanifest'), manifest('Sistem Yuran · Admin', 'Yuran Admin', '../'));

// Ibu bapa
let parent = inline(read('Parent.html')).replace('<base target="_top">', pwaHead('', 'manifest.webmanifest', 'Sistem Yuran'));
if (/<\?/.test(parent)) throw new Error('Scriptlet tertinggal dalam parent');
fs.writeFileSync(path.join(out, 'index.html'), parent);
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), manifest('Sistem Yuran', 'Sistem Yuran', ''));

// Fail statik
for (const f of ['pwa.js', 'sw.js']) fs.copyFileSync(path.join(web, f), path.join(out, f));
for (const f of fs.readdirSync(path.join(web, 'icons'))) fs.copyFileSync(path.join(web, 'icons', f), path.join(out, 'icons', f));
if (!fs.existsSync(path.join(out, 'config.js'))) fs.copyFileSync(path.join(web, 'config.js'), path.join(out, 'config.js'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('OK -> docs/ (ibu bapa) dan docs/admin/ (admin)');
