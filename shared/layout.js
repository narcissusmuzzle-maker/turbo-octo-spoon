/**
 * Раскладка экрана (чистые функции, без обращений к API часов — проверяются тестами в Node).
 *
 * Рабочая область — прямоугольник 0..H по высоте. Если системная полоска сверху скрыта (setStatusBarVisible(false)),
 * H = весь экран, 514 px. Если полоска есть, система сжимает страницу до 450 px (514 - 64). Свою высоту можно задать
 * на телефоне: LuvU613 -> ⚙️ -> «Вид на часах» (приходит в ответе на «sync», поле v.h).
 */
export const FULL_H = 514
export const MIN_H = 300
export const MAX_H = 600

/** Высота рабочей области: целое от MIN_H до MAX_H, иначе весь экран. */
export function cleanH(h) {
  const n = Math.round(+h)
  return n >= MIN_H && n <= MAX_H ? n : FULL_H
}

/** Высота одной из трёх равных строк экрана (очередь / верхний ряд / нижний ряд). */
export function rowH(h) { return Math.floor(h / 3) }

/**
 * Значки очереди. До 6 штук — один ряд (60 px, шаг 64). От 7 до 12 — два ряда, чуть меньше (44 px, шаг 54): оба ряда вместе занимают
 * в полтора раза больше высоты, чем один ряд из значков (2 × 44 + 2 = 90 = 1,5 × 60), и стоят по тому же центру строки очереди.
 * Ряды делят очередь поровну (7 — 4 + 3, 12 — 6 + 6), читаются слева направо и сверху вниз.
 */
export const Q_SIZE = 60
export const Q_STEP = 64
export const Q_ONE_MAX = 6
export const Q2_SIZE = 44
export const Q2_STEP = 54
export const Q2_VGAP = 2
export const Q_BLOCK = 2 * Q2_SIZE + Q2_VGAP   // 90: высота блока очереди (два ряда значков)
export const BAL_H = 44                        // высота строки баланса 🌸 (такая же в магазине и на главном экране)
export const BTN = 120                         // сторона кнопки занятия
export const MIN_GAP = 6                       // меньше этого зазор между блоками экрана не сжимается

/** Сколько значков в каждом ряду: [n] или [верхний, нижний]. */
export function queueRows(n) {
  if (n <= Q_ONE_MAX) return [n]
  return [Math.ceil(n / 2), Math.floor(n / 2)]
}

/**
 * Места значков очереди по порядку: [{ x, y, s }] (s — размер значка: Q_SIZE или Q2_SIZE). cx — середина экрана по горизонтали,
 * qTop — верх блока очереди высотой Q_BLOCK (90 px: два ряда по 44 px и зазор). Один ряд из 60-пиксельных значков стоит по центру этого блока.
 */
export function queuePlaces(n, cx, qTop) {
  const out = []
  if (n <= 0) return out
  const rows = queueRows(n)
  if (rows.length === 1) {
    const x0 = queueX0(n, cx, Q_SIZE, Q_STEP)
    const y = qTop + Math.round((Q_BLOCK - Q_SIZE) / 2)
    for (let j = 0; j < n; j++) out.push({ x: x0 + j * Q_STEP, y: y, s: Q_SIZE })
    return out
  }
  for (let r = 0; r < 2; r++) {
    const x0 = queueX0(rows[r], cx, Q2_SIZE, Q2_STEP)
    for (let j = 0; j < rows[r]; j++) out.push({ x: x0 + j * Q2_STEP, y: qTop + r * (Q2_SIZE + Q2_VGAP), s: Q2_SIZE })
  }
  return out
}

/** x левого значка очереди: n значков с шагом step и размером size стоят по центру cx. */
export function queueX0(n, cx, size, step) {
  const k = n > 0 ? n : 1
  return Math.round(cx - ((k - 1) * step + size) / 2)
}

/** Верх блока высотой block, стоящего по вертикали по центру области высотой h (не выше нуля). */
export function centerTop(h, block) { return Math.max(0, Math.round((h - block) / 2)) }

/** Предел сдвига строки по вертикали (пикселей вверх / вниз от обычного положения). */
export const MAX_OFF = 250

/** Сдвиг строки: целое число пикселей от -MAX_OFF до MAX_OFF, мусор — 0 (как раньше). */
export function cleanOff(n) {
  const v = Math.round(+n)
  return isFinite(v) ? Math.max(-MAX_OFF, Math.min(MAX_OFF, v)) : 0
}

/**
 * Верх предмета высотой size в строке r (0 — очередь, 1 — 🤿🎨🩸, 2 — 📖🧬💀): по центру своей трети экрана плюс сдвиг off.
 * Предмет не выходит за экран: верх не меньше 0, низ не ниже h.
 */
export function itemY(h, r, size, off) {
  const row = rowH(h)
  const y = row * r + Math.round((row - size) / 2) + cleanOff(off)
  return Math.max(0, Math.min(h - size, y))
}

/**
 * Настройки вида с телефона -> проверенные значения:
 *  h — высота рабочей области, hide — скрыть системную полоску (1 / 0), vib — вибрировать при включённом экране (1 / 0),
 *  y0, y1, y2 — сдвиг трёх строк по вертикали в пикселях (0 — как раньше).
 */
export function cleanView(v) {
  return {
    h: cleanH(v && v.h),
    hide: !v || v.hide === undefined ? 1 : (v.hide ? 1 : 0),
    vib: !v || v.vib === undefined ? 1 : (v.vib ? 1 : 0),
    y0: cleanOff(v && v.y0),
    y1: cleanOff(v && v.y1),
    y2: cleanOff(v && v.y2)
  }
}

/**
 * Три зоны по горизонтали (левая / центр / правая) — как три столбца кнопок занятий. Границы стоят посередине зазоров между столбцами:
 * left — отступ слева, cell — ширина кнопки, gap — зазор. Возвращает [граница 1, граница 2].
 */
export function zoneEdges(left, cell, gap) {
  const half = Math.floor(gap / 2)
  return [left + cell + half, left + 2 * cell + gap + half]
}

/** В какую зону (0 — левая, 1 — центр, 2 — правая) попадает x. */
export function zoneOf(x, edges) {
  return x < edges[0] ? 0 : (x < edges[1] ? 1 : 2)
}

/**
 * Раскладка главного экрана (с версии 1.15.0), сверху вниз: строка баланса 🌸 (BAL_H), очередь (блок Q_BLOCK), первый ряд кнопок (🧬 💀 🩸),
 * второй ряд кнопок (🤖 🧭 📖). Нижний ряд кнопок и верх экрана стоят там же, где стояли при трёх равных строках; зазоры очередь-первый ряд и
 * первый-второй ряд вдвое меньше прежних, а освободившееся место занимает строка баланса. Если места всё равно не хватает (низкий экран),
 * зазоры сжимаются дальше, но не меньше MIN_GAP. Размер кнопок не меняется.
 * y0 — сдвиг верхней группы (баланс и очередь вместе), y1 / y2 — сдвиг первого / второго ряда кнопок (настройки с телефона, 0 — как есть).
 * Возвращает { balY, qTop, b1, b2, balArea: {y, h}, qArea: {y, h} }: balArea — область нажатия строки баланса (от верха экрана),
 * qArea — область нажатия очереди (три зоны слева / по центру / справа делят её по столбцам кнопок).
 */
export function mainRows(h, y0, y1, y2) {
  const t0 = itemY(h, 0, Q_BLOCK, 0)       // прежний верх очереди из двух рядов — здесь теперь стоит строка баланса
  const o1 = itemY(h, 1, BTN, 0)
  const o2 = itemY(h, 2, BTN, 0)
  let gQ = Math.max(0, Math.floor((o1 - (t0 + Q_BLOCK)) / 2))   // зазор очередь — первый ряд, вдвое меньше прежнего
  let gR = Math.max(0, Math.floor((o2 - (o1 + BTN)) / 2))       // зазор первый — второй ряд, вдвое меньше прежнего
  const bottom = Math.min(h, o2 + BTN)
  let balY = t0
  const place = () => {
    const b2 = bottom - BTN
    const b1 = b2 - gR - BTN
    const qBot = b1 - gQ
    return { b1: b1, b2: b2, qTop: qBot - Q_BLOCK }
  }
  let p = place()
  for (let guard = 0; guard < 400 && p.qTop - (balY + BAL_H) < MIN_GAP && (gQ > MIN_GAP || gR > MIN_GAP); guard++) {
    if (gQ >= gR && gQ > MIN_GAP) gQ--
    else if (gR > MIN_GAP) gR--
    else gQ--
    p = place()
  }
  if (p.qTop - (balY + BAL_H) < MIN_GAP) balY = Math.max(0, p.qTop - BAL_H - MIN_GAP)   // совсем низкий экран: баланс уходит выше, но не за край
  const d0 = cleanOff(y0)
  const clampTop = (y, size) => Math.max(0, Math.min(h - size, y))
  const bal = clampTop(balY + d0, BAL_H)
  const qT = clampTop(p.qTop + d0, Q_BLOCK)
  const r1 = clampTop(p.b1 + cleanOff(y1), BTN)
  const r2 = clampTop(p.b2 + cleanOff(y2), BTN)
  const mid1 = Math.round((bal + BAL_H + qT) / 2)       // граница областей нажатия: баланс / очередь
  const mid2 = Math.round((qT + Q_BLOCK + r1) / 2)      // очередь / первый ряд кнопок
  return { balY: bal, qTop: qT, b1: r1, b2: r2, balArea: { y: 0, h: mid1 }, qArea: { y: mid1, h: Math.max(1, mid2 - mid1) } }
}
