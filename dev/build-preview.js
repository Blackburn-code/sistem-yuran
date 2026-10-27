/**
 * Bina dist/preview.html: panel admin lengkap dengan data demo, boleh dibuka terus dalam pelayar.
 * Guna: node dev/build-preview.js
 */
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'apps-script');
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');

function build(page, outName) {
let html = read(page);
html = html.replace(/<\?!= include\('(\w+)'\); \?>/g, (_, name) => read(name + '.html'));
html = html.replace('<?!= bootJson ?>', JSON.stringify({ namaSistem: 'Sistem Yuran', logoUrl: '' }));
const server = ['Schema.js', 'Core.js', 'Demo.js'].map(read).join('\n')
  + '\n' + fs.readFileSync(path.join(__dirname, 'mock-platform.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(__dirname, 'preview-boot.js'), 'utf8');
html = html.replace('<script>window.BOOT', '<script>\n' + server + '\n</script>\n    <script>window.BOOT');
if (/<\?/.test(html)) throw new Error('Scriptlet belum diganti');
const out = path.join(__dirname, '..', 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, outName), html);
}
build('Admin.html', 'preview.html');
build('Parent.html', 'preview-parent.html');
console.log('OK -> dist/preview.html (admin@demo.my / demo1234) dan dist/preview-parent.html');
