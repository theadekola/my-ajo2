const fs = require('node:fs');
const path = require('node:path');
const roots = [
  path.join(__dirname, '..', 'dist', 'assets'),
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public', 'assets'),
];
let changed = 0;
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of fs.readdirSync(root)) {
    if (!file.endsWith('.js')) continue;
    const full = path.join(root, file);
    let src = fs.readFileSync(full, 'utf8');
    const original = src;
    src = src.replace(/function mg\(\)\{const\[e,t\]=y\.useState\(!1\);return y\.useEffect\(\(\)=>\{t\(!fc\(\)\)\},\[\]\),e\?/,
      'function mg(){return null;/* native mobile hides cookie banner */const[e,t]=y.useState(!1);return y.useEffect(()=>{t(!fc())},[]),e?');
    if (src !== original) {
      fs.writeFileSync(full, src, 'utf8');
      console.log(`Patched cookie banner in ${full}`);
      changed += 1;
    }
  }
}
if (!changed) console.log('No packaged cookie banner pattern found to patch. Rebuild will pick up source change.');
