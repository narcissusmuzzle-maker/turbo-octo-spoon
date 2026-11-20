/**
 * Журнал вибрации и будильников (для поиска причин, почему вибрация не сработала при погасшем экране).
 * Две отдельные записи: страница пишет в файл lg_p.txt, служба-будильник — в lg_s.txt (чтобы не мешать друг другу и хранилищу состояния).
 * Строка файла: «время в миллисекундах|текст». Здесь только чистые функции (читаются и в тестах Node); сами файлы читает и пишет страница.
 *
 * Тексты записей:
 *   S <вид> +<секунд после границы> <буква A-D . c> [m<номер сцены> <итог>] f<сек> w<на руке> d<мс>
 *                                             — сработала служба-будильник; буква — см. app-service/alarm.js (A-D — вибрация, «.» — тихо, c — тихо + проверка часов);
 *                                               итог ok — вибромотор принял команду, E:... — ошибка; f — секунд с последнего «тика» страницы (при погасшем
 *                                               экране — просто время с погасания); w — датчик «часы на руке»; d — сколько мс занял вызов вибромотора
 *   Z C n=<обороты> dt=<мс>ms, Z c n=… dt=…   — служба закончила цикл (C — удержание, c — проверка часов); нет такой строки у C — службу прибили раньше
 *   T start <секунд>s                         — начало нового теста (занятие запущено, когда ничего не шло, в тестовом режиме)
 *   P open <alarm|->                          — страница открылась (alarm — её разбудил будильник, «-» — экран включили руками)
 *   E <сколько> <fresh|old>                   — страница засчитала события (fresh — «свежие», тогда она вибрирует сама)
 *   PV <ok|off|E:...>                         — вибрация самой страницы
 *   A <токены>                                — страница расставила будильники: s<через сколько секунд>:<номер> — служба, p… — страница,
 *                                               <токен>= — такой уже стоял, :X — система отказала
 */
export const LOG_MAX = 80       // строк в каждом файле
export const TEXT_MAX = 33      // длиннее текст на экране не помещается

export function two(n) { return n < 10 ? '0' + n : '' + n }

/** «чч:мм:сс» по местному времени. */
export function stamp(ms) {
  const d = new Date(ms)
  return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds())
}

/** Файл (текст) -> [{ t, text }], пустые и битые строки пропускаются. */
export function parse(content) {
  const out = []
  if (typeof content !== 'string' || !content) return out
  const lines = content.split('\n')
  for (let k = 0; k < lines.length; k++) {
    const s = lines[k]
    const i = s.indexOf('|')
    if (i <= 0) continue
    const t = +s.slice(0, i)
    if (!(t > 0)) continue
    out.push({ t: t, text: s.slice(i + 1) })
  }
  return out
}

/** Дописать запись в конец файла, оставив не больше [max] последних. Возвращает новый текст файла. */
export function append(content, ms, text, max) {
  const lim = max > 0 ? max : LOG_MAX
  const items = parse(content)
  items.push({ t: Math.round(ms), text: String(text).replace(/[\r\n|]+/g, ' ') })
  const cut = items.length > lim ? items.slice(items.length - lim) : items
  let s = ''
  for (let k = 0; k < cut.length; k++) s += cut[k].t + '|' + cut[k].text + '\n'
  return s
}

/** Две записи (службы и страницы) в одну по времени, от старых к новым. */
export function merge(a, b) {
  const all = (a || []).concat(b || [])
  all.sort((x, y) => x.t - y.t)
  return all
}

/** Какого цвета показывать строку: 'err' — ошибка / отказ, 'svc' — служба, 'page' — страница. */
export function kindOf(text) {
  if (/ E:|:X|noV/.test(text)) return 'err'
  if (/^[SZ] /.test(text)) return 'svc'
  return 'page'
}

/** Одна строка на экране: время и текст (длинный текст обрезается). */
export function line(e) {
  const tx = e.text.length > TEXT_MAX ? e.text.slice(0, TEXT_MAX - 1) + '~' : e.text
  return stamp(e.t) + ' ' + tx
}

/** Итог по журналу: сколько раз сработала служба, сколько ошибок, сколько раз открылась страница. */
export function summary(entries) {
  let s = 0
  let e = 0
  let p = 0
  for (let k = 0; k < entries.length; k++) {
    const x = entries[k].text
    if (/^S /.test(x)) s++
    if (kindOf(x) === 'err') e++
    if (/^P open/.test(x)) p++
  }
  return { s: s, e: e, p: p }
}

/** Страница журнала: новые записи сверху. page — номер (0 — самые новые), per — сколько строк на странице. */
export function pageOf(entries, page, per) {
  const total = entries.length
  const pages = Math.max(1, Math.ceil(total / per))
  const pg = Math.max(0, Math.min(pages - 1, page))
  const rows = []
  for (let k = 0; k < per; k++) {
    const i = total - 1 - (pg * per + k)
    if (i < 0) break
    rows.push({ text: line(entries[i]), kind: kindOf(entries[i].text) })
  }
  return { rows: rows, pages: pages, page: pg }
}

/** Сводка по последнему тесту (одна страница вместо нескольких): номера срабатываний службы после последней записи «T start», с буквой (A-D — вибрация, «.» — тихо, c — тихо + проверка часов).
 *  Пометки: ! — ошибка вибромотора, ? — способ C, а строки «Z» после него нет (службу прибили, пока она держала себя живой).
 *  Возвращает { since — время начала (мс, 0 — если метки нет), items: [{ n, letter, mark, t }] }. */
export function sheet(entries) {
  let from = 0
  let since = 0
  for (let k = entries.length - 1; k >= 0; k--) {
    if (/^T /.test(entries[k].text)) { from = k + 1; since = entries[k].t; break }
  }
  const items = []
  for (let k = from; k < entries.length; k++) {
    const x = entries[k].text
    if (!/^S /.test(x)) continue
    const m = /^S \S+ (?:\+\d+s )?([A-D.c])(?: |$)/.exec(x)
    const letter = m ? m[1] : '-'
    let mark = ''
    if (/ E:|noV/.test(x)) mark += '!'
    if (letter === 'C') {
      const nx = entries[k + 1]
      if (!(nx && /^Z /.test(nx.text))) mark += '?'
    }
    items.push({ n: items.length + 1, letter: letter, mark: mark, t: entries[k].t })
  }
  return { since: since, items: items }
}

/** Строки страницы-сводки: по [perRow] значков в ряд, например «1A  2B  3C  4D  5A  6B». */
export function sheetRows(items, perRow) {
  const rows = []
  for (let k = 0; k < items.length; k += perRow) {
    let s = ''
    for (let j = k; j < Math.min(items.length, k + perRow); j++) s += (j > k ? '   ' : '') + items[j].n + items[j].letter + items[j].mark
    rows.push(s)
  }
  return rows
}
