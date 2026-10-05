const fs = require('node:fs');
const path = require('node:path');

const target = path.join(__dirname, '..', 'android', 'capacitor-cordova-android-plugins', 'build.gradle');

if (!fs.existsSync(target)) {
  console.log('Capacitor Cordova Gradle file not found; skipping flatDir cleanup.');
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const cleaned = source.replace(
  /\r?\n\s*flatDir\s*\{\s*dirs\s+['"]src\/main\/libs['"]\s*,\s*['"]libs['"]\s*\}/g,
  '',
);

if (cleaned !== source) {
  fs.writeFileSync(target, cleaned, 'utf8');
  console.log('Removed unused flatDir repository from Capacitor Cordova Gradle file.');
} else {
  console.log('No flatDir repository found in Capacitor Cordova Gradle file.');
}
