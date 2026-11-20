/**
 * Логика таймеров для часов Amazfit (Zepp OS). Чистый JS без обращений к API часов — поэтому проверяется
 * тестами в Node (tests/core.test.mjs).
 *
 * Таймер занятия работает «равными промежутками»:
 *  - длина промежутка = «ценность 🩸» (60, 45, 30 или 15 минут; хранится на часах, меняется на экране настройки);
 *  - в конце промежутка часы вибрируют, телефону уходит событие «прошла полная ценность», таймер сразу идёт дальше;
 *  - паузы нет, есть только «стоп»: таймер обнуляется (снова равен ценности), а телефону уходит то, сколько
 *    времени успело пройти (в пересчёте на ценность — см. stopOne);
 *  - одновременно идёт только один таймер: запуск другого останавливает прежний (с отправкой пройденного времени).
 * ТАЙМЕР МАГАЗИНА (1.20.0, st.sh) — один: 🌴 (в магазине вместо эмодзи показываются минуты, строка закрашена цветом). Запускается покупкой (shopBuy).
 *  - срока у него нет: он считает время ВВЕРХ от запуска, пока его не остановят;
 *  - цена зависит от того, сколько он проработал за последний час (скользящее окно): первые 10 минут бесплатно; блок 10–20 минут — 1, 20–30 — 2, 30–40 — 2,
 *    40–50 — 3, 50–60 — 3, дальше не растёт (3). Цена блока списывается, когда блок НАЧИНАЕТСЯ (в 10:00, 20:00, ... работы; первый блок — при запуске, и он бесплатный,
 *    если за последний час таймер работал меньше 10 минут). Примеры: 9:59 — 0; 20:00 — 3 (1+2); 55 минут — 11 (1+2+2+3+3);
 *  - не хватает 🌸 на следующий блок — таймер останавливается в момент начала блока (вибрация, как в конце занятия);
 *  - обычное нажатие на таймер в магазине — пауза / продолжение (на паузе время не считается); долгое — остановка;
 *  - запуск занятия, серого таймера или автостарта останавливает таймер магазина (уже списанное остаётся).
 * Серый таймер на весь экран (k='y') — обычным нажатием по центру очереди:
 *  - серый    (k='y') длиной в ценность 🩸 — обычное нажатие по центру очереди (моно-занятие 🏠: очередь не трогает); по окончании телефону уходит
 *    ценность 🩸 для 🏠 (подвал, баллы). Серый таймер внутри автостарта (🏠 / 🔍 в очереди) закрывает свой пункт очереди.
 * Очередь занятий живёт на часах (st.queue, до 12 эмодзи) и ФИКСИРОВАННАЯ: занятия закрываются строго одно за другим, с первого, и ТОЛЬКО автостартом.
 * Занятие, запущенное нажатием на кнопку (или серый таймер по центру очереди), — «МОНО»: очередь оно не трогает, даже если стоит в ней первым.
 * Минуты занятий (и очередных, и моно) уходят телефону как раньше; кроме них телефону уходят две записи для журнала: очередь (qlog, см. ниже)
 * и моно-занятие (mlog: один запуск занятия от нажатия до остановки; длительность = число полных промежутков × ценность 🩸, меньше MONO_MIN — не уходит).
 *  По окончании любой цветной таймер сам закрывается (экран возвращается к занятиям), приложение при этом не закрывается.
 * Автостарт очереди (st.auto): запускается занятие, которое стоит в очереди первым; когда его полный промежуток заканчивается
 * (телефону уходит полная ценность 🩸, занятие убирается из очереди), сразу запускается следующее по очереди — и так до конца очереди.
 * 🏠 / 🔍 в очереди (бывают только в случайной очереди) идут серым таймером. Остановка занятия (нажатие на него, запуск другого занятия
 * или цветного таймера, досрочный выход из серого) автостарт выключает. Всё считается по меткам времени, поэтому работает и при погасшем
 * экране / закрытом приложении (будильники — см. nextDue).
 * Тестовый режим (st.test, переключается долгим нажатием на правую кнопку нижнего ряда): все промежутки и все цветные таймеры длятся
 * 20 секунд, а телефону уходит то, как если бы прошла полная ценность (чтобы проверить всю цепочку по-настоящему).
 * Всё считается по меткам времени: если приложение закрывалось, закончившиеся промежутки всё равно засчитаются.
 */
export const MIN = 60 * 1000
export const VALUES = [10, 20, 30, 40, 50, 60, 70, 80, 90]    // варианты ценности 🩸, минут (область экрана настройки: 1 — 10, 5 — 50, 9 — 90)
export const TEST_LEN = 20 * 1000      // тестовый режим: 20 секунд (не больше трёх границ в минуту — чтобы заодно проверить гипотезу о лимите)
export const SH_BLOCK = 10 * MIN        // таймер магазина 🌴: цена списывается за каждые 10 минут (в момент начала блока)
export const SH_BLOCK_TEST = 4 * 1000   // то же в тестовом режиме (час = 6 блоков = 24 секунды)
export const SH_TABLE = [0, 1, 2, 2, 3, 3]   // цена блока по числу полных блоков, проработанных за последний час: 0 — 0, 1 — 1, 2 — 2, 3 — 2, 4 — 3, 5 и больше — 3
export const SH_TONE = [2, 4]           // цвет строки таймера: меньше 2 блоков (20 минут) — зелёный, меньше 4 (40 минут) — жёлтый, дальше — красный
export const FRESH = 20 * 1000            // событие «свежее», если случилось не раньше 20 секунд назад (тогда подаём сигнал)
export const MIN_STOP = 1000              // стоп раньше чем через секунду телефону не отправляем
export const COUNT = 6                    // шесть занятий, порядок как на экране: слева направо, сверху вниз
export const MAX_OUT = 500                // сколько неподтверждённых событий храним
export const MONO_MIN = 60               // моно-занятие попадает в журнал телефона, только если сумма его полных промежутков не меньше стольких минут
export const QUEUE_MAX = 12               // сколько занятий помещается в очередь
export const QUEUE_RANDOM_LEN = 6         // длина случайной очереди
export const SLOT_LEN = 6                 // длина очереди, которую можно сохранить в ячейку (короткая; длинная — две такие подряд)
export const STATE_V = 6                  // версия сохранённого состояния (6 — новые эмодзи занятий; очередь из прошлых версий сбрасывается)

// эмодзи в порядке картинок i0..i8 / q0..q8 / m0..m8: шесть занятий (как на экране слева направо, сверху вниз:
// 🧬 💀 🩸 / 🤖 🧭 📖), затем 🏠 🍀 🔍
export const EMOJI = ['\u{1F9EC}', '\u{1F480}', '\u{1FA78}', '\u{1F916}', '\u{1F9ED}', '\u{1F4D6}', '\u{1F3E0}', '\u{1F340}', '\u{1F50D}']
const GRAY_ITEMS = [EMOJI[6], EMOJI[8]]   // что убирает из очереди серый таймер: 🏠 и 🔍 (🍀 серый таймер не учитывает, в очередь он не попадает)

// Магазин (открывается на часах долгим нажатием на строку баланса): семь товаров. Первым идёт таймер 🌴 (его цена — правило shopRate, на телефоне её нет), остальные — обычные покупки.
// SHOP_POS — в какую из девяти ячеек сетки 3×3 (слева направо, сверху вниз) ставится товар: 🌴 — по центру первой строки, остальные — в двух нижних строках.
// timer — 'g': покупка запускает таймер магазина. Эмодзи сверяются со строкой телефона целиком (👁️ — с селектором U+FE0F).
export const SHOP = [
  { e: '\u{1F334}', timer: 'g' },                    // 🌴 таймер: считает вверх, цена по часу работы
  { e: '\u{1F35A}', timer: '' },                     // 🍚
  { e: '\u{1F964}', timer: '' },                     // 🥤
  { e: '\u{1F9C1}', timer: '' },                     // 🧁
  { e: '\u{1FAE6}', timer: '' },                     // 🫦
  { e: '\u{1F441}\uFE0F', timer: '' },             // 👁️ обычная покупка
  { e: '\u{1F4AC}', timer: '' }                      // 💬
]
export const SHOP_POS = [1, 3, 4, 5, 6, 7, 8]
// из чего собирается случайная очередь (🍀 в очередь не попадает), у всех равный шанс
export const RANDOM_POOL = [EMOJI[0], EMOJI[1], EMOJI[2], EMOJI[3], EMOJI[4], EMOJI[5], EMOJI[6], EMOJI[8]]

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x) }
function two(n) { return n < 10 ? '0' + n : '' + n }

function cleanVal(v) {
  const n = Math.round(+v)
  return n >= 1 && n <= 600 ? n : 60
}

export function newState(test, val) {
  const run = []
  for (let i = 0; i < COUNT; i++) run.push(0)
  // q.k: '' — нет, 'r' красный, 'p' жёлтый, 'g' зелёный, 'y' серый; q.s: 0 — нет, 1 — идёт (закончившийся таймер сразу закрывается); auto — идёт автостарт очереди
  return { v: STATE_V, test: !!test, auto: false, ta: 0, val: cleanVal(val || 60), run: run, q: { k: '', s: 0, run: 0 }, out: [], queue: [], qs: null, mono: null, hold: null, fb: null, fp: {}, su: [], sh: null }
}

/** Привести сохранённое состояние к рабочему виду (на случай пустых/старых данных). */
export function restore(text, test, val) {
  const st = newState(!!test, val)
  if (!text) return st
  try {
    const o = JSON.parse(text)
    if (o && o.run && o.run.length >= COUNT) {
      for (let i = 0; i < COUNT; i++) st.run[i] = +o.run[i] || 0
      if (o.val) st.val = cleanVal(o.val)
      st.test = !!o.test          // тестовый режим переживает перезапуск приложения
      st.auto = !!o.auto          // если на самом деле ничего не идёт, process() сам выключит автостарт
      st.ta = +o.ta > 0 ? +o.ta : 0   // когда начался тест (мс): от этого момента считаются номера границ в расписании вибрации теста
      if (o.q && o.q.s === 1 && o.q.k === 'y') {   // на весь экран бывает только серый; красный / жёлтый / зелёный из старых версий (покупка уже списана) отбрасываются
        st.q = { k: 'y', s: 1, run: o.q.run || 0 }
      }
      if (o.out && o.out.length !== undefined) {
        // события «новая очередь для телефона» (версия 15) больше не нужны: очередь теперь только на часах
        const keep = []
        // события «подарок» (k='g') тоже больше не нужны: подарков нет, телефон их игнорирует
        for (let k = 0; k < o.out.length; k++) if (o.out[k] && o.out[k].k !== 'qs' && o.out[k].k !== 'g') keep.push(o.out[k])
        st.out = keep
      }
      st.queue = o.v === STATE_V ? cleanQueue(o.queue) : []   // эмодзи занятий поменялись — старая очередь не годится
      st.qs = o.v === STATE_V ? cleanQs(o.qs, st.queue) : null   // начатая, но ещё не законченная очередь (запись для журнала телефона)
      // идущее моно-занятие (запуск нажатием): нужно, чтобы после перезапуска приложения посчитанные круги не потерялись
      const mo = cleanMono(o.mono)
      if (mo && !st.auto && (mo.i < COUNT ? st.run[mo.i] > 0 : (mo.i === 6 && st.q.s === 1 && st.q.k === 'y'))) st.mono = mo
      // временная пауза 🩸 (hold): идёт 🩸, а прежнее занятие (или серый таймер) заморожено на том же месте
      const h = o.hold
      if (h && st.run[2] > 0 && !st.auto && Number.isInteger(h.a) && h.a !== 2) {
        const g = h.g ? 1 : 0
        if (g ? (h.a === 6 || h.a === 8) : (h.a >= 0 && h.a < COUNT)) {
          st.hold = { a: h.a, g: g, el: Math.max(0, +h.el || 0), auto: !!h.auto && st.queue.length > 0, mono: cleanMono(h.mono) }
        }
      }
      // магазин: последний известный баланс и цены (кэш от телефона), отработанные отрезки таймера 🌴 за последний час и сам таймер
      st.fb = typeof o.fb === 'number' && isFinite(o.fb) ? Math.round(o.fb) : null
      st.fp = cleanPrices(o.fp)
      st.su = cleanSu(o.su)
      st.sh = cleanSh(o.sh)
      if (st.sh && (st.auto || st.q.s === 1 || st.run.some((x) => x > 0))) st.sh = null   // идти вместе с занятием не может
    }
  } catch (e) { /* битые данные — начинаем с чистого состояния */ }
  return st
}

/** Таймер магазина из сохранённого состояния: i — товар (0), k — 'g', run — начало текущего отрезка (0 — пауза), el — сколько проработал до него, n — сколько блоков по 10 минут уже начато (и оплачено). Таймеры прошлых версий (без n) отбрасываются. */
function cleanSh(o) {
  if (!o || o.i !== 0 || o.k !== 'g' || !(+o.n >= 1)) return null
  return { i: 0, k: 'g', run: +o.run > 0 ? +o.run : 0, el: Math.max(0, +o.el || 0), n: Math.round(+o.n) }
}

/** Отработанные отрезки таймера 🌴 [[начало, конец], ...] (мс): только последний час, не больше 200 штук. */
function cleanSu(a) {
  const out = []
  if (!a || a.length === undefined) return out
  for (let k = 0; k < a.length && out.length < 200; k++) {
    const x = a[k]
    if (x && +x[0] > 0 && +x[1] > +x[0]) out.push([+x[0], +x[1]])
  }
  return out
}

function cleanMono(mo) {
  if (!mo || !Number.isInteger(mo.i) || mo.i < 0 || mo.i > 6 || !(+mo.t0 > 0)) return null
  return { i: mo.i, t0: +mo.t0, n: Math.max(0, Math.round(+mo.n) || 0), val: cleanVal(mo.val), x: mo.x ? 1 : 0 }
}

/**
 * Ценность 🩸 по области экрана настройки: сетка 3×3, как цифры на цифровой клавиатуре (7 8 9 / 4 5 6 / 1 2 3), номер области × 10 минут.
 * r — строка (0 — верхняя, 1 — средняя, 2 — нижняя), c — столбец (0 — левый, 1 — средний, 2 — правый).
 * Левый нижний угол — 10, центр — 50, правый верхний — 90, левый верхний — 70, правый нижний — 30.
 */
export function areaVal(r, c) {
  const rr = Math.max(0, Math.min(2, Math.floor(+r) || 0))
  const cc = Math.max(0, Math.min(2, Math.floor(+c) || 0))
  return ((2 - rr) * 3 + cc + 1) * 10
}

/** Ценность 🩸 в миллисекундах: столько «набегает» занятию за полный промежуток. */
export function valueMs(st) { return st.val * MIN }

/** Реальная длина промежутка, мс (в тестовом режиме 20 секунд). */
export function fullMs(st) { return st.test ? TEST_LEN : st.val * MIN }

/** Длина цветного таймера, мс. */
export function ovLen(st) {
  if (st.test) return TEST_LEN
  return st.val * MIN   // на весь экран бывает только серый (таймер магазина — st.sh)
}

export function running(st, i) { return st.run[i] > 0 }

/** Цветной таймер на экране (пока идёт). */
export function overlayActive(st) { return st.q.s !== 0 }

export const LOOP = '\u{1F504}'   // 🔄: над цифрами у моно-занятия (не очередь)

/** Какой экран на весь экран сейчас нужен: '' — никакого (главный), 'r' / 'p' / 'g' / 'y' — цветные и серый, 'a' — розовый (идёт занятие из шести). */
export function overlayKind(st) {
  if (st.q.s !== 0) return st.q.k
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return 'a'
  return ''
}

/** Номер в EMOJI того, что идёт сейчас на сером / розовом экране (занятие или цель серого таймера); -1 — ничего. */
export function activeIdx(st) {
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return i
  if (st.q.s === 1 && st.q.k === 'y') return grayTarget(st)
  return -1
}

/** Что показывать над цифрами на сером / розовом экране: остаток очереди (идёт автостарт — или он на паузе 🩸) либо 🔄 и эмодзи моно-занятия. */
export function ovTop(st) {
  const k = overlayKind(st)
  if (k !== 'a' && k !== 'y') return []
  const auto = st.hold ? st.hold.auto : st.auto
  if (auto && st.queue.length) return st.queue.slice()
  const e = activeIdx(st)
  return e < 0 ? [] : [LOOP, EMOJI[e]]
}

/** Сколько осталось до конца круга у того, что идёт на сером / розовом экране, мс. */
export function ovLeftAny(st, now) {
  if (st.q.s === 1) return ovLeft(st, now)
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return clamp(remaining(st, i, now), 0, fullMs(st))
  return 0
}

/** Остаток промежутка занятия, мс (может быть ≤ 0, если срабатывание ещё не обработано). */
export function remaining(st, i, now) {
  return st.run[i] > 0 ? fullMs(st) - (now - st.run[i]) : fullMs(st)
}

export function anyRunning(st) {
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return true
  return st.q.s === 1
}

/** Сколько осталось на цветном таймере, мс. */
export function ovLeft(st, now) {
  if (st.q.s !== 1) return 0
  const len = ovLen(st)
  return clamp(len - (now - st.q.run), 0, len)
}

/** Очередь из чего угодно: только известные эмодзи (без 🍀), не больше QUEUE_MAX. */
export function cleanQueue(a) {
  const out = []
  if (!a || a.length === undefined) return out
  for (let k = 0; k < a.length && out.length < QUEUE_MAX; k++) {
    const e = String(a[k])
    if (EMOJI.indexOf(e) >= 0 && e !== EMOJI[7]) out.push(e)
  }
  return out
}

/**
 * Долгое нажатие на кнопку занятия: вызвать очередь из её ячейки [slot] (ровно SLOT_LEN эмодзи). Возвращает новую очередь или null — «ничего не менять».
 *  - в ячейке не шесть эмодзи (пустая) — null;
 *  - в очереди ровно эти шесть — удваиваются (12): повторное нажатие на ту же кнопку;
 *  - в очереди уже эти шесть дважды — null: третье нажатие ничего не делает;
 *  - иначе (очередь пуста или в ней что-то другое, в том числе очередь другой ячейки) — очередь заменяется шестью эмодзи ячейки.
 */
export function slotQueue(queue, slot) {
  const s = cleanQueue(slot)
  if (s.length !== SLOT_LEN) return null
  const q = cleanQueue(queue)
  const same = (a, b) => a.length === b.length && a.every((e, k) => e === b[k])
  if (same(q, s)) return s.concat(s)
  if (same(q, s.concat(s))) return null
  return s.slice()
}

/**
 * ЗАПИСЬ ОЧЕРЕДИ для второго слоя журнала на телефоне. Пока в очереди что-то есть, часы только копят сведения в st.qs (и ничего не шлют):
 *   { t0 — когда началась очередь (мс: начало первого выполненного занятия), val — ценность 🩸 на тот момент (минут), seq — очередь целиком
 *     как она была, left — какие места seq ещё не выполнены (по порядку, всегда столько же, сколько эмодзи в st.queue), last — когда выполнено
 *     последнее, x — тестовый режим }.
 * Телефону запись уходит ОДИН раз — событием {k:'qr'}: когда в очереди не осталось эмодзи (всё выполнено) или когда очередь убрали / заменили
 * (setQueue). Очередь, в которой ничего не выполнено, записью не становится. Пауза и возобновление ничего не меняют: запись живёт, пока в очереди есть эмодзи.
 */
function cleanQs(o, queue) {
  if (!o || !(+o.t0 > 0) || !o.seq || o.seq.length === undefined || !o.left || o.left.length === undefined) return null
  const seq = cleanQueue(o.seq)
  const left = []
  for (let k = 0; k < o.left.length; k++) {
    const i = Math.round(+o.left[k])
    if (i >= 0 && i < seq.length) left.push(i)
  }
  if (!seq.length || left.length !== queue.length || left.length >= seq.length) return null   // очередь менялась мимо записи или ничего не выполнено — записи нет
  return { t0: +o.t0, val: cleanVal(o.val), seq: seq, left: left, last: +o.last > 0 ? +o.last : +o.t0, x: o.x ? 1 : 0 }
}

/** Закрыть запись очереди: поставить в очередь отправки событие (если что-то было выполнено). Возвращает событие или null. */
function qsFinish(st, endTs) {
  const s = st.qs
  st.qs = null
  if (!s) return null
  const m = []
  let done = 0
  for (let k = 0; k < s.seq.length; k++) {
    const d = s.left.indexOf(k) < 0
    if (d) done++
    m.push(d ? '1' : '0')
  }
  if (!done) return null
  const ev = { id: 'qr' + s.t0, k: 'qr', ts: s.t0, v: s.val, q: s.seq.join(''), m: m.join(''), d: Math.max(0, (s.last > 0 ? s.last : endTs) - s.t0), x: s.x ? 1 : 0, tried: 0 }
  st.out.push(ev)
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return ev
}

/** Первое занятие очереди выполнено автостартом в момент [at]: записать в st.qs (начав запись, если это первое выполненное). Вызывать ДО удаления из st.queue. */
function qsTrack(st, at) {
  if (!st.qs || st.qs.left.length !== st.queue.length) {
    const left = []
    for (let i = 0; i < st.queue.length; i++) left.push(i)
    st.qs = { t0: at - fullMs(st), val: st.val, seq: st.queue.slice(), left: left, last: at, x: st.test ? 1 : 0 }
  }
  st.qs.left.splice(0, 1)
  st.qs.last = at
}

/**
 * Поставить очередь [q] вручную (ввод, вызов из ячейки, удаление). Начатая очередь, которую заменили или удалили, закрывается:
 * то, что в ней было выполнено, уходит телефону записью. Возвращает событие или null.
 */
export function setQueue(st, q, now) {
  const ev = qsFinish(st, now)
  st.queue = cleanQueue(q)
  return ev
}

/**
 * Закрыть первое занятие очереди (только автостарт: очередь фиксированная, закрывается по порядку). Возвращает убранный эмодзи или null.
 * [at] — когда занятие выполнено (мс): по нему ведётся запись очереди для телефона; когда в очереди не осталось эмодзи, запись закрывается.
 */
export function queueClose(st, at) {
  if (!st.queue.length) return null
  if (at > 0) qsTrack(st, at)
  const gone = st.queue.shift()
  if (at > 0 && !st.queue.length) qsFinish(st, at)
  return gone
}

// ====================== МОНО-ЗАНЯТИЯ ======================

/** Начался запуск занятия [i] нажатием на кнопку (не автостарт): считаем его полные промежутки. */
function monoBegin(st, i, now) {
  st.mono = { i: i, t0: now, n: 0, val: st.val, x: st.test ? 1 : 0 }
}

/** Закончился запуск моно-занятия (стоп, запуск другого, цветной таймер): если сумма полных промежутков не меньше MONO_MIN — запись для журнала. */
function monoEnd(st) {
  const m = st.mono
  st.mono = null
  if (m) monoPush(st, m.i, m.t0, m.n, m.val, m.x)
}

/** Поставить в очередь отправки запись моно-занятия [i] (номер в EMOJI): n полных промежутков по val минут, начало t0. Меньше MONO_MIN — ничего. */
function monoPush(st, i, t0, n, val, x) {
  if (!(n > 0) || n * val < MONO_MIN) return null
  const ev = { id: 'mo' + t0 + '-' + i, k: 'mo', ts: t0, i: i, v: val, n: n, x: x ? 1 : 0, tried: 0 }
  st.out.push(ev)
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return ev
}

/**
 * Случайная очередь из QUEUE_RANDOM_LEN занятий: два одинаковых подряд не бывает, повторы не подряд — бывают.
 * Каждое следующее выбирается поровну из всех, кроме предыдущего. [rnd] — источник случайных чисел [0, 1) (для проверки в тестах).
 */
export function randomQueue(rnd) {
  const f = rnd || Math.random
  const out = []
  while (out.length < QUEUE_RANDOM_LEN) {
    const last = out.length ? out[out.length - 1] : ''
    const alt = []
    for (let k = 0; k < RANDOM_POOL.length; k++) if (RANDOM_POOL[k] !== last) alt.push(RANDOM_POOL[k])
    out.push(alt[Math.min(alt.length - 1, Math.floor(f() * alt.length))])
  }
  return out
}

/**
 * Обработать сработавшее. Возвращает { events, fresh, ovDone, ovFresh, ovKind }.
 * Закончившийся цветной таймер закрывается сам (ovDone = true, ovKind — каким он был).
 * Новые события добавляются и в st.out (очередь на отправку телефону, пока не придёт подтверждение).
 */
export function process(st, now) {
  const events = []
  let fresh = false
  const full = fullMs(st)
  const sr = processShop(st, now)   // таймер магазина: списание на пятой минуте, конец
  if (st.auto) {
    const a = processAuto(st, now, events)
    return { events: events, fresh: a.fresh, ovDone: a.ovDone || sr.ovDone, ovFresh: a.ovFresh || sr.ovFresh, ovKind: a.ovKind || sr.ovKind, shop: sr.charged }
  }
  for (let i = 0; i < COUNT; i++) {
    const s = st.run[i]
    if (s <= 0) continue
    if (now - s < full) continue
    let t = s + full
    let count = 0
    while (t <= now && count < 24) {
      const ev = { id: 'b' + i + '-' + t, k: 'b', i: i, ts: t, ms: valueMs(st), f: 1, x: st.test ? 1 : 0, tried: 0 }
      events.push(ev)
      st.out.push(ev)
      if (st.mono && st.mono.i === i) st.mono.n++   // моно-занятие: ещё один полный промежуток (очередь не трогается)
      if (now - t <= FRESH) fresh = true
      t += full
      count++
    }
    st.run[i] = count >= 24 ? now : t - full   // новый промежуток начался в момент последнего срабатывания
  }

  let ovDone = sr.ovDone
  let ovFresh = sr.ovFresh
  let ovKind = sr.ovKind
  if (st.q.s === 1) {
    const len = ovLen(st)
    if (now - st.q.run >= len) {
      if (st.q.k === 'y') {
        // серый таймер идёт ПО КРУГУ (как занятия): каждый полный круг — ценность 🩸 для 🏠, потом сразу следующий круг. Это моно 🏠: очередь не трогается
        const gi = grayTarget(st)
        let t = st.q.run + len
        let count = 0
        while (t <= now && count < 24) {
          const ev = { id: 'b' + gi + '-y' + t, k: 'b', i: gi, ts: t, ms: valueMs(st), f: 1, x: st.test ? 1 : 0, tried: 0 }
          events.push(ev)
          st.out.push(ev)
          if (st.mono && st.mono.i === gi) st.mono.n++
          if (now - t <= FRESH) fresh = true
          t += len
          count++
        }
        st.q.run = count >= 24 ? now : t - len
      } else {
        const at = st.q.run + len
        ovKind = st.q.k
        ovDone = true
        ovFresh = now - at <= FRESH
        st.q = { k: '', s: 0, run: 0 }
      }
    }
  }
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return { events: events, fresh: fresh, ovDone: ovDone, ovFresh: ovFresh, ovKind: ovKind, shop: sr.charged }
}

/** Что идёт сейчас: { a: номер занятия } / { y: true } (серый таймер) / null. Нужно автостарту: одновременно идёт только одно. */
function autoCurrent(st) {
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) return { a: i }
  if (st.q.s === 1 && st.q.k === 'y') return { y: true }
  return null
}

/** Запустить с момента [at] то, что стоит в очереди первым: занятие — своим таймером, 🏠 / 🔍 — серым. false — очередь пуста. */
function autoStartHead(st, at) {
  if (!st.queue.length) return false
  const idx = EMOJI.indexOf(st.queue[0])
  if (idx >= 0 && idx < COUNT) st.run[idx] = at
  else st.q = { k: 'y', s: 1, run: at }
  return true
}

/**
 * Автостарт: что закончилось к моменту [now] — засчитывается (событие телефону, занятие убирается из очереди), и сразу с момента
 * окончания запускается следующее из очереди. Закончилась очередь (или ничего не идёт) — автостарт выключается.
 */
function processAuto(st, now, events) {
  const r = { fresh: false, ovDone: false, ovFresh: false, ovKind: '' }
  for (let n = 0; n < 40 && st.auto; n++) {
    const cur = autoCurrent(st)
    if (!cur) { st.auto = false; break }
    let at
    if (cur.a !== undefined) {
      const i = cur.a
      const full = fullMs(st)
      if (now - st.run[i] < full) break
      at = st.run[i] + full
      const ev = { id: 'b' + i + '-' + at, k: 'b', i: i, ts: at, ms: valueMs(st), f: 1, x: st.test ? 1 : 0, tried: 0 }
      events.push(ev)
      st.out.push(ev)
      queueClose(st, at)
      st.run[i] = 0
      if (now - at <= FRESH) r.fresh = true
    } else {
      const len = ovLen(st)
      if (now - st.q.run < len) break
      at = st.q.run + len
      const gi = grayTarget(st)
      queueClose(st, at)
      const ev = { id: 'b' + gi + '-y' + at, k: 'b', i: gi, ts: at, ms: valueMs(st), f: 1, x: st.test ? 1 : 0, tried: 0 }
      events.push(ev)
      st.out.push(ev)
      st.q = { k: '', s: 0, run: 0 }
      r.ovDone = true
      r.ovKind = 'y'
      if (now - at <= FRESH) r.ovFresh = true
    }
    if (!autoStartHead(st, at)) st.auto = false
  }
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return r
}

/** Включить автостарт очереди: запускается то, что стоит в очереди первым. Только когда ничего не идёт и очередь не пуста. */
export function startAuto(st, now) {
  const res = process(st, now)
  if (anyRunning(st) || !st.queue.length) return res
  st.ta = now
  interruptShop(st, now)   // автостарт очереди прерывает таймер магазина
  st.auto = true
  autoStartHead(st, now)
  return res
}

/** Включить / выключить тестовый режим (все таймеры по 20 секунд). Только когда ничего не идёт. Возвращает true, если режим поменялся. */
export function toggleTest(st) {
  if (anyRunning(st)) return false
  st.test = !st.test
  return true
}

/** Кому идёт время серого таймера: номер в EMOJI. Автостарт — тому, что стоит в очереди первым (🏠 / 🔍); серый таймер, запущенный нажатием (моно), — всегда 🏠. */
export function grayTarget(st) {
  if (st.auto && st.queue.length && GRAY_ITEMS.indexOf(st.queue[0]) >= 0) return EMOJI.indexOf(st.queue[0])
  return 6
}

/**
 * Серый таймер остановлен раньше времени: пройденное время (в пересчёте на ценность 🩸, как у обычных занятий) ставится в очередь отправки
 * тому же занятию, что и при полном окончании. Из очереди ничего не убирается (как и у обычных занятий при остановке).
 * Короче секунды телефону не отправляется. Возвращает событие или null; сам таймер не закрывает.
 */
function stopGray(st, now) {
  if (st.q.s !== 1 || st.q.k !== 'y') return null
  if (st.mono && st.mono.i === 6) monoEnd(st)   // моно 🏠 закончено: запись для журнала, если набралось достаточно
  const el = now - st.q.run
  if (el < MIN_STOP) return null
  const gi = grayTarget(st)
  const ms = Math.round(el / ovLen(st) * valueMs(st))
  const ev = { id: 'b' + gi + '-ys' + now, k: 'b', i: gi, ts: now, ms: ms, f: 0, x: st.test ? 1 : 0, tried: 0 }
  st.out.push(ev)
  return ev
}

/** Остановить занятие [i]: обнулить и поставить в очередь отправки пройденное время (в пересчёте на ценность). */
function stopOne(st, i, now) {
  const s = st.run[i]
  if (s <= 0) return null
  st.run[i] = 0
  if (st.mono && st.mono.i === i) monoEnd(st)   // моно-занятие закончено: запись для журнала, если набралось достаточно
  const el = now - s
  if (el < MIN_STOP) return null
  const ms = Math.round(el / fullMs(st) * valueMs(st))
  const ev = { id: 'b' + i + '-s' + now, k: 'b', i: i, ts: now, ms: ms, f: 0, x: st.test ? 1 : 0, tried: 0 }
  st.out.push(ev)
  return ev
}

/** Нажатие на кнопку занятия: запуск / стоп. Запуск останавливает любой другой идущий таймер. */
export function toggle(st, i, now) {
  const res = process(st, now)
  const idle = !anyRunning(st) && st.q.s === 0
  dropHold(st, now)
  if (st.run[i] > 0) {
    stopOne(st, i, now)
  } else {
    if (idle) st.ta = now   // начало теста: от этой точки считаются номера границ
    for (let k = 0; k < COUNT; k++) if (k !== i) stopOne(st, k, now)
    stopGray(st, now)   // серый таймер, если он вдруг ещё идёт, закрывается с отправкой пройденного времени
    interruptShop(st, now)   // таймер магазина 🌴 останавливается
    st.q = { k: '', s: 0, run: 0 }
    st.run[i] = now
    monoBegin(st, i, now)   // запуск нажатием — моно-занятие: очередь оно не закрывает
  }
  st.auto = false   // остановка занятия (или запуск другого) выключает автостарт (после остановок: от автостарта зависит, кому идёт время серого)
  return res
}

/** Запустить цветной таймер ('r' красный, 'p' жёлтый, 'g' зелёный, 'y' серый); идущее занятие останавливается. */
export function startOverlay(st, kind, now) {
  const res = process(st, now)
  if (st.q.s !== 0) return res
  if (!anyRunning(st)) st.ta = now   // начало теста: от этой точки считаются номера границ
  dropHold(st, now)
  interruptShop(st, now)   // серый — тоже «занятие» (🏠): таймер магазина останавливается
  for (let k = 0; k < COUNT; k++) stopOne(st, k, now)
  st.auto = false
  st.q = { k: kind, s: 1, run: now }
  if (kind === 'y') monoBegin(st, 6, now)   // серый, запущенный нажатием, — моно 🏠
  return res
}

/** Закрыть цветной таймер, ничего не отправляя. */
export function endOverlay(st) {
  st.q = { k: '', s: 0, run: 0 }
}

/**
 * Досрочный выход из цветного таймера (долгое нажатие). Серый — пройденное время занятию (🏠 / 🔍, см. grayTarget);
 * красный, жёлтый, зелёный — ничего (покупка уже ушла и не возвращается). Возвращает событие или null.
 */
export function exitOverlay(st, now) {
  const res = process(st, now)           // вдруг он уже закончился — тогда событие уже создано (а автостарт мог пойти дальше)
  if (st.q.s !== 1) return { res: res, ev: null }
  const ev = stopGray(st, now)
  st.auto = false
  st.q = { k: '', s: 0, run: 0 }
  return { res: res, ev: ev }
}

/** Временная пауза 🩸 закончилась не возвратом (остановили совсем и т.п.): замороженное занятие отпускается — пройденное им время и моно-запись уходят телефону. */
function dropHold(st, now) {
  const h = st.hold
  if (!h) return
  st.hold = null
  if (h.mono) monoPush(st, h.mono.i, h.mono.t0, h.mono.n, h.mono.val, h.mono.x)
  if (h.el >= MIN_STOP) {
    const ms = Math.round(h.el / fullMs(st) * valueMs(st))
    st.out.push({ id: 'b' + h.a + '-h' + now, k: 'b', i: h.a, ts: now, ms: ms, f: 0, x: st.test ? 1 : 0, tried: 0 })
  }
}

/**
 * Обычное нажатие на серый / розовый экран = ВРЕМЕННАЯ ПАУЗА 🩸. Идёт занятие (или серый таймер, в том числе внутри автостарта) — оно замораживается на
 * своём месте круга, а идёт 🩸 (как моно-запуск: полные круги, порог MONO_MIN). Повторное нажатие: 🩸 останавливается (пройденное время уходит телефону),
 * занятие продолжается с того же места, а автостарт — если он шёл — снова включается. Если уже идёт 🩸 (не временная) — ничего не происходит.
 * Возвращает { res, changed }.
 */
export function tapOverlay(st, now) {
  const res = process(st, now)
  if (st.hold) {
    const h = st.hold
    stopOne(st, 2, now)
    st.hold = null
    const at = now - h.el
    if (h.g) st.q = { k: 'y', s: 1, run: at }
    else st.run[h.a] = at
    st.auto = h.auto
    st.mono = h.mono
    return { res: res, changed: true }
  }
  const cur = autoCurrent(st)
  if (!cur || cur.a === 2) return { res: res, changed: false }
  let a
  let g = 0
  let el
  if (cur.a !== undefined) { a = cur.a; el = now - st.run[a]; st.run[a] = 0 }
  else { a = grayTarget(st); g = 1; el = now - st.q.run; st.q = { k: '', s: 0, run: 0 } }
  st.hold = { a: a, g: g, el: clamp(el, 0, fullMs(st)), auto: !!st.auto, mono: st.mono }
  st.mono = null
  st.auto = false
  st.run[2] = now
  monoBegin(st, 2, now)
  return { res: res, changed: true }
}

/** Остановить совсем (долгое нажатие на любой цветной экран): идущее занятие / серый таймер — с отправкой пройденного времени, замороженное занятие тоже, автостарт выключается. */
export function stopAll(st, now) {
  const res = process(st, now)
  let ev = null
  for (let i = 0; i < COUNT; i++) stopOne(st, i, now)
  if (st.q.s === 1) {
    if (st.q.k === 'y') ev = stopGray(st, now)
    st.q = { k: '', s: 0, run: 0 }
  }
  dropHold(st, now)
  st.auto = false
  return { res: res, ev: ev }
}

/** Подтверждение от телефона: событие больше не нужно отправлять. */
export function ack(st, id) {
  const n = []
  let removed = false
  for (let k = 0; k < st.out.length; k++) {
    if (st.out[k].id === id) removed = true
    else n.push(st.out[k])
  }
  st.out = n
  return removed
}

/** События, которые пора (пере)отправить: прошло не меньше [gap] мс с прошлой попытки. */
export function due(st, now, gap) {
  const r = []
  for (let k = 0; k < st.out.length; k++) {
    if (now - (st.out[k].tried || 0) >= gap) r.push(st.out[k])
  }
  return r
}

/** Метка на кнопке занятия: минуты вверх (до ценности), в тестовом режиме — секунды. */
export function label(st, ms) {
  if (st.test) return '' + clamp(Math.ceil(ms / 1000), 1, Math.round(TEST_LEN / 1000))
  return '' + clamp(Math.ceil(ms / MIN), 1, st.val)
}

/** «мм:сс» (секунды вверх, как у обычного таймера: 15:00 -> 14:59 -> ... -> 00:01 -> 00:00). */
export function clock(ms) {
  const s = Math.ceil(clamp(ms, 0, 90 * MIN) / 1000)
  return two(Math.floor(s / 60)) + ':' + two(s % 60)
}

/** Сколько ближайших границ занятия заранее ставится службе-будильнику (вибрация). Страница при погасшем экране не оживает (будильник страницы её не будит), поэтому вибрации хватит ровно на столько границ, пока экран не включат. */
export const ALARM_AHEAD = 12
/** В тестовом режиме границы идут через 20 секунд, и окно длиннее — 24 границы (8 минут): чтобы тест не обрывался на середине. */
export const ALARM_AHEAD_TEST = 24
export function aheadFor(st) { return st.test ? ALARM_AHEAD_TEST : ALARM_AHEAD }

/**
 * РАСПИСАНИЕ ВИБРАЦИИ В ТЕСТЕ (диагностика, см. app-service/alarm.js). Служба-будильник срабатывает на КАЖДОЙ границе (как и раньше),
 * а вибрирует ли она на этой границе и как — написано здесь, по одной букве на границу (1-я буква — 1-я граница после начала теста):
 *   A — вибрировать «как было» (start({ mode: STRONG_REMINDER }), серия коротких); B, C, D — прежние запасные способы (см. alarm.js);
 *   . — ТИХО: служба просто срабатывает и пишет строку в журнал, вибромотор не трогает;
 *   c — тихо + проверка часов службы (короткий цикл, в журнал идёт число оборотов и сколько мс он занял).
 * Расписание: 4 вибрации подряд через 20 с (границы 1-4), потом три раза через 60 с (7, 10, 13), потом через 120 с (19) и снова четыре подряд
 * через 20 с (19-22: «после долгого покоя»); границы 5 и 16 — тихие с проверкой часов службы, остальные пропуски — просто тихие. Способ везде один (A), чтобы буква не путалась с временем: в 1.12.0 буквы шли по кругу A B C D,
 * то есть каждый способ приходился на свою фазу 80-секундного круга, и «способ» нельзя было отделить от «момента».
 * Номер границы считается от начала теста (st.ta — момент запуска из состояния «ничего не идёт»), поэтому у одной и той же границы буква
 * всегда одна и та же, как бы ни пересчитывался план. За концом расписания (и если начало теста неизвестно) — A.
 */
export const TEST_PLAN = 'AAAAc.A..A..A..c..AAAA..'
export const METHODS = ['A', 'B', 'C', 'D', '.', 'c']
export function methodFor(st, boundarySec, everySec) {
  if (!st.test || !(everySec > 0) || !(st.ta > 0)) return 'A'
  const k = Math.round((boundarySec * 1000 - st.ta) / (everySec * 1000))   // 1 — первая граница после начала теста
  if (k < 1 || k > TEST_PLAN.length) return 'A'
  return TEST_PLAN.charAt(k - 1)
}

/**
 * План будильников: что должно стоять в системе прямо сейчас. Для каждой ближайшей границы — будильник службы (вибрация, через секунду
 * после границы) и, для самой первой, будильник страницы (через 4 секунды: приложение откроется, посчитает и отправит минуты на телефон).
 * Занятие, которое идёт по кругу, получает службу на [ahead] границ вперёд; автостарт — только на оставшиеся границы очереди;
 * цветной таймер — одну. У каждого будильника свой ключ (вид + граница + сколько границ ещё впереди): страница сравнивает план с уже
 * поставленным и трогает только разницу (так два будильника не встают на одну секунду и не мешают друг другу).
 * Элемент: { key, url, param, at } — at в секундах (UTC).
 */
export function alarmPlan(st, ahead) {
  const out = []
  const every = Math.round(fullMs(st) / 1000)
  const due = nextDue(st)
  for (let k = 0; k < due.length; k++) {
    const d = due[k]
    const sec = Math.round(d.t / 1000)
    let steps = 1
    if (d.kind === 'hour' && every > 0) steps = d.n === undefined ? ahead : Math.min(ahead, d.n + 1)
    for (let j = 0; j < steps; j++) {
      const bs = sec + j * every
      const left = d.n === undefined ? -1 : d.n - j
      out.push({ key: 's' + d.kind + bs + ':' + left, url: 'app-service/alarm', param: d.kind + '|' + bs + '|' + left + '|' + methodFor(st, bs, every), at: bs + 1 })
      if (j === 0) out.push({ key: 'p' + bs, url: 'page/index', param: 'alarm', at: bs + 4 })
    }
  }
  return out
}

/**
 * Сравнить уже поставленные будильники [{ k: ключ, i: номер }] с планом: kept — что оставить, cancel — номера того, что снять (лишнее и
 * старый формат), add — что нужно поставить, keep — ключи оставленного.
 */
export function alarmDiff(old, plan) {
  const want = {}
  for (let k = 0; k < plan.length; k++) want[plan[k].key] = true
  const keep = {}
  const kept = []
  const cancel = []
  const list = Array.isArray(old) ? old : []
  for (let k = 0; k < list.length; k++) {
    const o = list[k]
    if (o && typeof o === 'object' && want[o.k] && !keep[o.k]) { keep[o.k] = true; kept.push(o) }
    else cancel.push(o && typeof o === 'object' ? o.i : o)
  }
  const add = []
  for (let k = 0; k < plan.length; k++) if (!keep[plan[k].key]) add.push(plan[k])
  return { kept: kept, cancel: cancel, add: add, keep: keep }
}

/**
 * Привести будильники в системе к плану: лишние снять, недостающие поставить. api = { set(url, param, delay) -> номер или 0 / исключение,
 * cancel(номер) }. Если система отказала, пробуем на секунду позже (до трёх раз): раньше отказ молча глотался, и вибрация пропадала.
 * Возвращает { next — что теперь стоит [{ k, i }] (его надо сохранить), tok — короткие записи для журнала, plan }.
 */
export function applyAlarms(st, nowMs, old, api) {
  const plan = alarmPlan(st, aheadFor(st))
  const diff = alarmDiff(old, plan)
  for (let k = 0; k < diff.cancel.length; k++) { try { api.cancel(diff.cancel[k]) } catch (e) { /* уже сработал */ } }
  const next = diff.kept.slice()
  const tok = []
  for (let k = 0; k < plan.length; k++) {
    const w = plan[k]
    const tag = w.url === 'page/index' ? 'p' : 's'
    const delay = Math.max(1, Math.ceil(w.at - nowMs / 1000))
    if (diff.keep[w.key]) { tok.push(tag + delay + '='); continue }
    let id = 0
    let tries = 0
    let err = ''
    for (; tries < 4; tries++) {
      try {
        id = api.set(w.url, w.param, delay + tries)
        if (id) break
        err = 'id' + id
      } catch (e) { err = String(e).slice(0, 12) }
    }
    if (id) { next.push({ k: w.key, i: id }); tok.push(tag + (delay + tries) + ':' + id) }
    else tok.push(tag + delay + ':X(' + err + ')')
  }
  return { next: next, tok: tok, plan: plan }
}

/** Моменты, когда что-то закончится (для будильников): [{ t, kind }]. */
export function nextDue(st) {
  const r = []
  const full = fullMs(st)
  if (st.auto) {
    // автостарт: границы стоят через равные промежутки (по одной на каждое занятие в очереди); n — сколько границ после первой
    const cur = autoCurrent(st)
    if (cur) r.push({ t: (cur.a !== undefined ? st.run[cur.a] : st.q.run) + full, kind: 'hour', n: Math.max(0, st.queue.length - 1) })
    return r
  }
  for (let i = 0; i < COUNT; i++) if (st.run[i] > 0) r.push({ t: st.run[i] + full, kind: 'hour' })
  if (st.q.s === 1) r.push({ t: st.q.run + ovLen(st), kind: st.q.k === 'y' ? 'hour' : 'quick' })   // серый идёт по кругу — как занятие
  return r
}

// ====================== МАГАЗИН ======================

/** Цены от телефона -> { эмодзи: целое >= 0 } только для обычных товаров магазина (🌴 в списке не бывает: его цена — правило shopRate). */
export function cleanPrices(p) {
  const out = {}
  if (!p || typeof p !== 'object') return out
  for (let k = 1; k < SHOP.length; k++) {
    const v = p[SHOP[k].e]
    if (typeof v === 'number' && isFinite(v) && v >= 0) out[SHOP[k].e] = Math.round(v)
  }
  return out
}

/** Длина блока цены таймера 🌴, мс (в тестовом режиме 4 секунды). Окно «за последний час» — шесть блоков. */
export function shBlock(st) { return st.test ? SH_BLOCK_TEST : SH_BLOCK }

/** Сколько таймер 🌴 проработал за час до момента [t], мс (скользящее окно): законченные отрезки st.su плюс идущий отрезок st.sh (до [t]). Паузы не считаются. */
export function shopUsed(st, t) {
  const a0 = t - 6 * shBlock(st)
  let sum = 0
  for (let k = 0; k < st.su.length; k++) {
    const a = Math.max(st.su[k][0], a0)
    const b = Math.min(st.su[k][1], t)
    if (b > a) sum += b - a
  }
  const s = st.sh
  if (s && s.run > 0) {
    const a = Math.max(s.run, a0)
    if (t > a) sum += t - a
  }
  return sum
}

/** Цена следующего блока 🌴 (10 минут) в момент [t]: по тому, сколько таймер проработал за последний час. Меньше 10 минут — 0, 10–20 — 1, 20–30 — 2, 30–40 — 2, 40 и больше — 3. */
export function shopRate(st, t) {
  const n = Math.floor(shopUsed(st, t) / shBlock(st))
  return SH_TABLE[Math.min(SH_TABLE.length - 1, n)]
}

/** Цена товара [idx] сейчас: число или null (цена не задана — товар не продаётся; у 🌴 цена — правило shopRate, она есть всегда). */
export function shopPrice(st, idx, now) {
  if (idx === 0) return shopRate(st, now)
  const v = st.fp[SHOP[idx].e]
  return typeof v === 'number' ? v : null
}

/** Покупки, которые телефон ещё не подтвердил (их цена на телефоне пока не списана — из показанного баланса она вычитается). */
export function pendingSpend(st) {
  let sum = 0
  for (let k = 0; k < st.out.length; k++) if (st.out[k].k === 'p') sum += st.out[k].c
  return sum
}

/** Баланс 🌸 для показа и для проверки покупки: последний баланс телефона минус ещё не подтверждённые покупки. null — баланса нет. */
export function shopBalance(st) {
  return st.fb === null ? null : st.fb - pendingSpend(st)
}

/** Принять ответ телефона {b, p}: баланс и цены заменяются присланными (источник правды — телефон). false — ответ без баланса. */
export function setShopFrom(st, f) {
  if (!f || typeof f.b !== 'number' || !isFinite(f.b)) return false
  st.fb = Math.round(f.b)
  st.fp = cleanPrices(f.p)
  return true
}

let buySeq = 0

// ====================== ТАЙМЕР МАГАЗИНА (st.sh) ======================
// st.sh = { i — товар (0, 🌴), k — 'g', run — начало текущего отрезка (0 — пауза), el — сколько проработал до этого отрезка, мс,
//           n — сколько блоков по 10 минут уже начато (и оплачено): 1 сразу после запуска }
// st.su — отработанные отрезки [[начало, конец], ...] за последний час: по ним считается цена (shopRate).

/** Сколько таймер магазина проработал в этом запуске (без пауз), мс. */
export function shopActive(st, now) {
  const s = st.sh
  return s ? s.el + (s.run > 0 ? Math.max(0, now - s.run) : 0) : 0
}

/** Подпись на месте эмодзи в магазине: сколько минут проработал (0, 1, 2, ...), в тестовом режиме — секунды. Нет таймера — пусто. */
export function shopLabel(st, now) {
  const s = st.sh
  if (!s) return ''
  const act = shopActive(st, now)
  return '' + Math.floor(act / (st.test ? 1000 : MIN))
}

/** Цвет строки таймера по времени запуска на экране: 'g' — зелёный (до 20 минут), 'p' — жёлтый (до 40), 'r' — красный. */
export function shopTone(st, now) {
  const n = Math.floor(shopActive(st, now) / shBlock(st))
  return n < SH_TONE[0] ? 'g' : (n < SH_TONE[1] ? 'p' : 'r')
}

/** Записать отработанный отрезок [a, b] (в окно часа); старше часа отбрасывается. */
function shopSeg(st, a, b) {
  if (!(b > a)) return
  st.su.push([a, b])
  const keep = []
  for (let k = 0; k < st.su.length; k++) if (st.su[k][1] > b - 60 * MIN) keep.push(st.su[k])
  st.su = keep.length > 200 ? keep.slice(keep.length - 200) : keep
}

/** Списать цену [c] за блок, начавшийся в момент [ts]: событие buy в очередь отправки. Бесплатный блок (0) ничего не отправляет. */
function shopCharge(st, c, ts, n) {
  if (!(c > 0)) return null
  const ev = { id: 'p' + ts + '-0-t' + n, k: 'p', e: SHOP[0].e, c: c, ts: ts, tried: 0 }
  st.out.push(ev)
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return ev
}

/** Таймер магазина к моменту [now]: каждый начавшийся блок (в 10:00, 20:00, ... работы) оплачивается ценой по часу работы на этот момент (а не когда страница открылась).
 *  Не хватает 🌴 на блок — таймер останавливается в момент его начала (ovDone). */
function processShop(st, now) {
  const r = { ovDone: false, ovFresh: false, ovKind: '', charged: false }
  const s = st.sh
  if (!s || s.run <= 0) return r
  const b = shBlock(st)
  for (let guard = 0; guard < 500; guard++) {
    const tk = s.run + s.n * b - s.el   // момент начала блока номер n (n × 10 минут работы)
    if (tk > now) break
    const c = shopRate(st, tk)
    if (c > 0) {
      const bal = shopBalance(st)
      if (bal === null || bal < c) {
        shopSeg(st, s.run, tk)
        st.sh = null
        r.ovDone = true
        r.ovKind = 'g'
        r.ovFresh = now - tk <= FRESH
        return r
      }
      shopCharge(st, c, tk, s.n)
      r.charged = true
    }
    s.n++
  }
  return r
}

/** Запустилось занятие / серый таймер / автостарт: таймер магазина останавливается (списанное остаётся). Вызывать после process. */
function interruptShop(st, now) {
  const s = st.sh
  if (!s) return
  if (s.run > 0) shopSeg(st, s.run, Math.max(s.run, now))
  st.sh = null
}

/** Обычное нажатие на таймер магазина: пауза / продолжение (пока что-то идёт — продолжить нельзя). Возвращает { res, ok, paused }. */
export function shopTap(st, now) {
  const res = process(st, now)
  const s = st.sh
  if (!s) return { res: res, ok: false, paused: false }
  if (s.run > 0) {
    s.el += Math.max(0, now - s.run)
    shopSeg(st, s.run, now)
    s.run = 0
    return { res: res, ok: true, paused: true }
  }
  if (anyRunning(st)) return { res: res, ok: false, paused: true }
  s.run = now
  return { res: res, ok: true, paused: false }
}

/** Долгое нажатие на таймер магазина: остановка (списанное остаётся). Возвращает { res, stopped, blocks } — сколько блоков было начато. */
export function shopStop(st, now) {
  const res = process(st, now)
  const s = st.sh
  const had = !!s
  const blocks = s ? s.n : 0
  if (s && s.run > 0) shopSeg(st, s.run, now)
  st.sh = null
  return { res: res, stopped: had, blocks: blocks }
}

/**
 * Купить товар [idx] за 🌸. Только по свежим данным телефона ([linked] — баланс и цены получены при этом открытии магазина).
 * Отказы (ничего не списывается и не уходит): nolink — нет связи / баланса; noprice — цена не задана; poor — баланса не хватает; busy — таймер магазина уже есть
 * (идёт или на паузе) или что-то идёт.
 * Обычный товар: событие {k:'p', e, c, ts} в очередь отправки, баланс на экране уменьшается сразу. 🌴: запускается таймер; цена первого блока (по часу работы,
 * может быть 0) списывается сразу, дальше — по блоку каждые 10 минут. Возвращает { ok, why, ev, res } (ev — событие покупки, если что-то списано сразу).
 */
export function shopBuy(st, idx, now, linked) {
  const res = process(st, now)
  const fail = (why) => ({ ok: false, why: why, ev: null, res: res })
  if (!SHOP[idx]) return fail('noitem')
  if (!linked || st.fb === null) return fail('nolink')
  const c = shopPrice(st, idx, now)
  if (c === null) return fail('noprice')
  if (shopBalance(st) < c) return fail('poor')
  const kind = SHOP[idx].timer
  if (kind) {
    if (st.sh || anyRunning(st)) return fail('busy')
    st.ta = now   // начало теста: от этой точки считаются номера границ
    const ev = shopCharge(st, c, now, 0)   // первый блок: цена по часу работы (0 — ничего не уходит)
    st.sh = { i: idx, k: kind, run: now, el: 0, n: 1 }
    return { ok: true, why: '', ev: ev, res: res }
  }
  buySeq++
  const ev = { id: 'p' + now + '-' + idx + '-' + buySeq + '-' + Math.floor(Math.random() * 1679616).toString(36), k: 'p', e: SHOP[idx].e, c: c, ts: now, tried: 0 }
  st.out.push(ev)
  if (st.out.length > MAX_OUT) st.out = st.out.slice(st.out.length - MAX_OUT)
  return { ok: true, why: '', ev: ev, res: res }
}
