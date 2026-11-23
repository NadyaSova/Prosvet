// Проверка страницы в настоящем браузере без окна (Edge или Chrome) через протокол отладки.
// Открывает адрес, ждёт, печатает текст страницы, ошибки и предупреждения консоли.
// Можно выполнить действие на странице (JS-выражение) и перезагрузить её — например, чтобы проверить,
// что данные пережили перезагрузку.
//
// Использование:
//   node scripts/check-page.mjs <путь к msedge.exe или chrome.exe> <url> [ждать мс=4000] [перезагрузок=0] [JS-действие]
// Пример (сначала запустить `npm run build` и `npx vite preview --port 4174`):
//   node scripts/check-page.mjs "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" http://localhost:4174/ 3000 1 "document.querySelector('button').click()"
//
// Снимок экрана: переменная окружения SCREENSHOT=<путь к .png>. Тогда окно — как у телефона (412×915),
// снимок делается в конце, после действия и перезагрузок. SHOT_ACTION=<JS> — выполнить перед самым снимком
// (например, прокрутить панораму). Если действие возвращает промис (async-функция), скрипт ждёт его.
//
// Почему не --dump-dom: он снимает страницу сразу после загрузки и не ждёт асинхронного открытия IndexedDB.

//
// Браузер закрывается командой Browser.close, а потом — на всякий случай — закрываются все процессы
// с этим профилем в командной строке. Закрыть по номеру процесса нельзя: запущенный msedge.exe сразу
// передаёт работу другому процессу и выходит. Раньше из-за этого браузеры оставались жить (сотни
// процессов, гигабайты памяти), держали профили, и каждый запуск ждал минуты, пока их удастся удалить.
// Порт отладки выбирает сам браузер (--remote-debugging-port=0), поэтому запуски не мешают друг другу.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const [browserPath, url, waitMs = '4000', reloads = '0', action] = process.argv.slice(2);
if (!browserPath || !url) {
  console.error('Нужно: node scripts/check-page.mjs <браузер> <url> [ждать мс] [перезагрузок] [JS-действие]');
  process.exit(1);
}

// Остатки прошлых запусков старше 10 минут: закрыть их браузеры и удалить профили.
// Свежие не трогаем — ими может пользоваться запуск, который идёт параллельно.
const stale = readdirSync(tmpdir())
  .filter((name) => name.startsWith('prosvet-cdp-'))
  .map((name) => join(tmpdir(), name))
  .filter((dir) => {
    try {
      return Date.now() - statSync(dir).mtimeMs > 10 * 60 * 1000;
    } catch {
      return false;
    }
  });
if (stale.length) {
  killBrowsers(stale);
  for (const dir of stale) removeProfile(dir);
}

const profile = mkdtempSync(join(tmpdir(), 'prosvet-cdp-'));
spawn(browserPath, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {
  stdio: 'ignore',
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browserWs;

try {
  // Порт браузер пишет в файл DevToolsActivePort своего профиля: первая строка — порт, вторая — путь.
  let port;
  for (let i = 0; i < 40 && !port; i++) {
    await sleep(250);
    try {
      const [p, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n');
      if (Number(p) > 0 && path) {
        port = Number(p);
        browserWs = `ws://127.0.0.1:${port}${path.trim()}`;
      }
    } catch {
      // браузер ещё запускается
    }
  }
  let target;
  for (let i = 0; port && i < 40 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {
      // страница ещё не готова
    }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('Браузер не запустился');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION', JSON.stringify(msg.params.exceptionDetails).slice(0, 500));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      console.log('CONSOLE', msg.params.type, msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const text = async () =>
    (await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value;

  await send('Runtime.enable');
  await send('Page.enable');
  const screenshot = process.env.SCREENSHOT;
  if (screenshot) {
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  }
  await send('Page.navigate', { url });
  await sleep(Number(waitMs));
  console.log('--- страница ---\n' + (await text()));

  if (action) {
    await send('Runtime.evaluate', { expression: action, awaitPromise: true });
    await sleep(Number(waitMs));
    console.log('--- после действия ---\n' + (await text()));
  }
  for (let i = 0; i < Number(reloads); i++) {
    await send('Page.reload');
    await sleep(Number(waitMs));
    console.log(`--- после перезагрузки ${i + 1} ---\n` + (await text()));
  }
  if (screenshot) {
    if (process.env.SHOT_ACTION) {
      await send('Runtime.evaluate', { expression: process.env.SHOT_ACTION, awaitPromise: true });
      await sleep(800);
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(screenshot, Buffer.from(shot.data, 'base64'));
    console.log(`--- снимок: ${screenshot} ---`);
  }
  ws.close();
} finally {
  // Профиль браузера весит десятки мегабайт — удалить его, когда браузер закроется и отпустит файлы.
  await closeBrowser();
  killBrowsers([profile]);
  removeProfile(profile);
}

/** Закрыть браузер его же командой и дождаться, пока он оборвёт связь (не дольше 3 секунд). */
async function closeBrowser() {
  if (!browserWs) return;
  try {
    const ws = new WebSocket(browserWs);
    await Promise.race([new Promise((r) => ws.addEventListener('open', r)), sleep(2000)]);
    const closed = new Promise((r) => ws.addEventListener('close', r));
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await Promise.race([closed, sleep(3000)]);
    await sleep(300);
  } catch {
    // браузер уже закрыт — дальше его процессы добьёт killBrowsers
  }
}

/** Закрыть все процессы браузера, у которых в командной строке один из этих профилей. */
function killBrowsers(dirs) {
  const names = dirs.map((d) => basename(d));
  if (process.platform === 'win32') {
    const match = names.map((n) => `$_.CommandLine -like '*${n}*'`).join(' -or ');
    const ps = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" | Where-Object { ${match} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
  } else {
    for (const n of names) spawnSync('pkill', ['-f', n], { stdio: 'ignore' });
  }
}

function removeProfile(dir, maxRetries = 10) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries, retryDelay: 300 });
  } catch (e) {
    console.warn(`Не удалось удалить профиль ${dir}: ${e.message}`);
  }
}
