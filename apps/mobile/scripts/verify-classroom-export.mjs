import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [platform, device] = process.argv.slice(2);
const appId = 'com.heidisoft.iconicedu';
const matches = (name) => /^classroom-[a-f0-9-]+\.png$/.test(name);
let files;
let read;
if (platform === 'ios') {
  const container = execFileSync(
    'xcrun',
    ['simctl', 'get_app_container', device, appId, 'data'],
    { encoding: 'utf8' },
  ).trim();
  const cache = path.join(container, 'Library/Caches');
  files = fs
    .readdirSync(cache)
    .filter(matches)
    .map((name) => ({ name, time: fs.statSync(path.join(cache, name)).mtimeMs }));
  read = (name) => fs.readFileSync(path.join(cache, name));
} else if (platform === 'android') {
  const adb = (args) => execFileSync('adb', ['-s', device, ...args]);
  files = adb(['shell', 'run-as', appId, 'ls', 'cache'])
    .toString()
    .split(/\r?\n/)
    .filter(matches)
    .map((name) => ({
      name,
      time:
        Number(
          adb(['shell', 'run-as', appId, 'stat', '-c', '%Y', `cache/${name}`])
            .toString()
            .trim(),
        ) * 1000,
    }));
  read = (name) => adb(['exec-out', 'run-as', appId, 'cat', `cache/${name}`]);
} else throw new Error('Expected ios or android and a device ID');
const latest = files.sort((a, b) => b.time - a.time)[0];
if (!latest) throw new Error('The native export did not create a PNG');
const png = read(latest.name);
if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  throw new Error('Invalid PNG export');
const width = png.readUInt32BE(16),
  height = png.readUInt32BE(20);
if (latest.time < Date.now() - 120000 || width < 100 || height < 30 || png.length < 1000)
  throw new Error('The latest export is stale, empty, or missing the educational asset');
console.log(`Verified native whiteboard PNG export (${width} × ${height})`);
