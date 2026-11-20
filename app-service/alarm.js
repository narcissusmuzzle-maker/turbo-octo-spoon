// Служба «будильник»: её запускает система в момент окончания таймера, даже если экран погашен и приложение закрыто.
//  - вибрирует первым делом и без всяких проверок (кроме «тихих» границ теста — буквы . и c, см. ниже);
//  - сама ничего не ставит: все будильники (на несколько ближайших границ вперёд) расставляет страница, см. core.alarmPlan;
//  - пишет строку в журнал (файл lg_s.txt) ПОСЛЕ вибрации; любая ошибка журнала на вибрацию не влияет.
// Параметр: вид|граница в секундах (UTC)|сколько границ ещё впереди (-1 — без ограничения)|буква (см. ниже; нет — значит A).
//
// БУКВА (в обычном режиме всегда A; в тесте её берёт расписание core.TEST_PLAN — по границам):
//   A — как в версии 1.11.1: новый Vibrator, start({ mode: STRONG_REMINDER }) — серия из четырёх коротких (1200 мс).
//   B — другая сцена: setMode(DURATION_LONG) + start() — одна длинная (1000 мс), та самая, которой вибрирует страница при горящем экране.
//   C — как A, но служба потом пытается «держать себя живой» до 2 секунд. В 1.12.0 этот цикл во всех трёх случаях вернул 0 мс (строки «Z C 0ms» с той же секундой, что и у «S»),
//       то есть на деле ничего не держал; теперь цикл ограничен и числом оборотов, и временем, а в журнал идёт и то и другое (Z C n=… dt=…).
//   D — stop() перед запуском, затем setMode(STRONG_REMINDER) + start().
//   . — ТИХО: служба срабатывает, пишет строку в журнал, вибромотор не трогает (даже Vibrator не создаётся).
//   c — тихо + проверка часов службы: короткий цикл (до 300 мс или 400 000 оборотов), в журнал — Z c n=<обороты> dt=<мс>.
// Служба живёт доли секунды (по документации система ограничивает разовый запуск ~600 мс), поэтому всё необязательное — после вибрации.
// Строка журнала: S <вид> +<сек после границы> <буква> [m<сцена> <итог>] f<сек> w<носят ли часы> d<мс на вызов вибромотора>
//   f — сколько секунд назад страница в последний раз «тикала» (она тикает, пока экран горит): при погасшем экране это просто время с погасания экрана;
//   w — состояние датчика «часы на руке» (если в прошивке он есть; число как отдаёт система — какое что значит, смотрим по данным);
//   d — сколько миллисекунд занял сам вызов вибромотора (если часы вообще засыпают внутри вызова, это видно).
import * as sensor from '@zos/sensor'
import { readFileSync, writeFileSync } from '@zos/fs'
import { LocalStorage } from '@zos/storage'

const LOG_FILE = 'lg_s.txt'
const LOG_MAX = 80
const HOLD_MS = 2000       // способ C: сколько пытаться держать службу
const CHECK_MS = 300       // проверка часов 'c'
const CHECK_CAP = 400000   // и не больше стольких оборотов (если Date.now() стоит на месте, цикл всё равно закончится)
const HOLD_CAP = 3000000

function scene(name) { return sensor[name] }

/** Вибрация выбранным способом. Возвращает { res: 'ok' | 'E:причина', m: номер сцены (для журнала) }. */
function buzz(method) {
  const sr = scene('VIBRATOR_SCENE_STRONG_REMINDER')
  const dl = scene('VIBRATOR_SCENE_DURATION_LONG')
  const mode = method === 'B' ? dl : sr
  let v = null
  try { v = new sensor.Vibrator() } catch (e) { return { res: 'E:noV ' + String(e).slice(0, 20), m: mode } }
  try {
    if (method === 'B') { v.setMode({ mode: mode }); v.start() }
    else if (method === 'D') { try { v.stop() } catch (e0) { /* нечего останавливать */ } v.setMode({ mode: mode }); v.start() }
    else v.start({ mode: mode })
    return { res: 'ok', m: mode }
  } catch (e) {
    try { v.setMode({ mode: mode }); v.start(); return { res: 'ok2', m: mode } } catch (e2) { return { res: 'E:' + String(e2).slice(0, 24), m: mode } }
  }
}

/** Дописать строку в журнал службы (последние LOG_MAX). Формат строки: «миллисекунды|текст». */
function logLine(ms, text) {
  try {
    let old = ''
    try { old = readFileSync({ path: LOG_FILE, options: { encoding: 'utf8' } }) } catch (e) { old = '' }
    const lines = typeof old === 'string' && old ? old.split('\n').filter((s) => s.indexOf('|') > 0) : []
    lines.push(Math.round(ms) + '|' + String(text).replace(/[\r\n|]+/g, ' '))
    const cut = lines.length > LOG_MAX ? lines.slice(lines.length - LOG_MAX) : lines
    writeFileSync({ path: LOG_FILE, data: cut.join('\n') + '\n', options: { encoding: 'utf8' } })
  } catch (e) { /* журнал не критичен */ }
}

/** Сколько секунд назад страница в последний раз «тикала» (она пишет метку каждые 2 секунды, пока экран горит): сколько часы «спят». */
function frozenFor(now) {
  try {
    const ls = new LocalStorage()
    const hb = +ls.getItem('hb', '')
    if (hb > 1000000000000) return ' f' + Math.min(999, Math.max(0, Math.round((now - hb) / 1000)))
  } catch (e) { /* без метки */ }
  return ''
}

/** Датчик «часы на руке» (если он есть в прошивке): ' w<число>', ' w?' — не прочитался, '' — датчика нет. */
function wearInfo() {
  try {
    if (typeof sensor.Wear !== 'function') return ''
    const w = new sensor.Wear()
    return ' w' + w.getStatus()
  } catch (e) { return ' w?' }
}

/** Цикл-«удержание»: крутится, пока не пройдёт [ms] по Date.now() ИЛИ не наберётся [cap] оборотов (чтобы не зависнуть, если время стоит на месте).
 *  Возвращает { n — сколько оборотов, dt — сколько мс прошло по Date.now() }. */
function hold(ms, cap) {
  const t0 = Date.now()
  let n = 0
  let dt = 0
  while (n < cap) {
    n++
    dt = Date.now() - t0
    if (dt >= ms) break
  }
  return { n: n, dt: dt }
}

AppService({
  onInit(param) {
    const now = Date.now()
    const parts = String(param || '').split('|')
    const L = parts[3]
    const method = L === 'B' || L === 'C' || L === 'D' || L === '.' || L === 'c' ? L : 'A'
    const silent = method === '.' || method === 'c'
    let r = null
    let took = -1
    if (!silent) {
      r = buzz(method)   // вибрация — первым делом
      took = Date.now() - now
    }
    try {
      const kind = parts[0] || '?'
      let b = +parts[1] || 0
      if (b < 1000000000) b = 0   // старый вид параметра: вместо границы там было «поколение»
      const late = b ? ' +' + Math.round(now / 1000 - b) + 's' : ''
      let text = 'S ' + kind + late + ' ' + method
      if (r) text += ' m' + (r.m === undefined ? '?' : r.m) + ' ' + r.res
      text += frozenFor(now) + wearInfo()
      if (took >= 0) text += ' d' + took
      logLine(now, text)
    } catch (e) { /* журнал не критичен */ }
    if (method === 'C') {
      const h = hold(HOLD_MS, HOLD_CAP)
      logLine(Date.now(), 'Z C n=' + h.n + ' dt=' + h.dt + 'ms')
    } else if (method === 'c') {
      const h = hold(CHECK_MS, CHECK_CAP)
      logLine(Date.now(), 'Z c n=' + h.n + ' dt=' + h.dt + 'ms')
    }
  },
  onDestroy() {}
})
