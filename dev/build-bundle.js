/**
 * Gabungkan semua fail kepada 3 fail sahaja (mudah disalin dari telefon):
 *   pasang/Code.gs, pasang/Admin.html, pasang/Parent.html
 * Guna: node dev/build-bundle.js
 */
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'apps-script');
const out = path.join(__dirname, '..', 'pasang');
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
const inline = (html) => html.replace(/<\?!= include\('(\w+)'\); \?>/g, (_, n) => read(n + '.html'));

fs.mkdirSync(out, { recursive: true });
const order = ['Main.js', 'Schema.js', 'Core.js', 'Platform.js', 'SheetStore.js', 'Demo.js'];
const code = '// SISTEM YURAN - salin SEMUA kandungan fail ini ke Code.gs\n// Dijana automatik daripada folder apps-script/. Jangan edit di sini.\n\n' +
  order.map((f) => '// ===== ' + f + ' =====\n' + read(f)).join('\n');
fs.writeFileSync(path.join(out, 'Code.gs'), code);
for (const f of ['Admin.html', 'Parent.html']) {
  const html = inline(read(f));
  if (/include\(/.test(html)) throw new Error('include tertinggal dalam ' + f);
  fs.writeFileSync(path.join(out, f), html);
}
console.log('OK -> pasang/Code.gs, pasang/Admin.html, pasang/Parent.html');
