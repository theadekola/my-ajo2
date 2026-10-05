const fs = require('node:fs');
const path = require('node:path');

const noopServiceWorker = "self.addEventListener('install',event=>{self.skipWaiting()});self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).then(()=>self.registration.unregister()).then(()=>self.clients.claim()))});\n";
const roots = [
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public'),
  path.join(__dirname, '..', 'ios', 'App', 'App', 'public'),
];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;

  const sw = path.join(root, 'sw.js');
  fs.writeFileSync(sw, noopServiceWorker, 'utf8');

  const assets = path.join(root, 'assets');
  if (!fs.existsSync(assets)) continue;

  for (const file of fs.readdirSync(assets)) {
    if (!file.endsWith('.js')) continue;
    const fullPath = path.join(assets, file);
    const source = fs.readFileSync(fullPath, 'utf8');
    let patched = source
      .replace(/!x2&&"serviceWorker"in navigator&&window\.addEventListener\("load",\(\)=>\{navigator\.serviceWorker\.register\("\/sw\.js"\)[\s\S]*?\.catch\(\(\)=>\{\}\)\}\);/, 'false&&"serviceWorker"in navigator;')
      .replace(/const x2=typeof window<"u"&&\(\([\s\S]*?\)\);!x2&&"serviceWorker"in navigator&&window\.addEventListener\("load",\(\)=>\{navigator\.serviceWorker\.register\("\/sw\.js"\)[\s\S]*?\.catch\(\(\)=>\{\}\)\}\);/, 'const x2=true;false&&"serviceWorker"in navigator;');

    if (patched !== source) {
      fs.writeFileSync(fullPath, patched, 'utf8');
      console.log(`Disabled service worker registration in ${fullPath}`);
    }
  }
}

// Capacitor CLI can emit Windows separators in SwiftPM path strings. Swift treats
// those backslashes as invalid escape sequences, so normalize the generated file.
const iosPackage = path.join(__dirname, '..', 'ios', 'App', 'CapApp-SPM', 'Package.swift');
if (fs.existsSync(iosPackage)) {
  const source = fs.readFileSync(iosPackage, 'utf8');
  const patched = source.replace(/path: "([^"]*)"/g, (match, value) => `path: "${value.replace(/\\/g, '/')}"`);
  if (patched !== source) {
    fs.writeFileSync(iosPackage, patched, 'utf8');
    console.log(`Normalized SwiftPM paths in ${iosPackage}`);
  }
}
