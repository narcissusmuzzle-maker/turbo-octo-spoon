/**
 * Таймеры занятий (6 штук, 2×3: 🧬 💀 🩸 / 🤖 🧭 📖), баланс 🌸 и очередь занятий сверху, цветные таймеры, экран настройки ценности 🩸 и МАГАЗИН 🌸
 * (версия 1.19.0). Подробности логики — в shared/core.js, места на экране — в shared/layout.js. Свайпов в приложении нет: всё управляется нажатиями.
 * Экран сверху вниз (области нажатия):
 *      БАЛАНС 🌸 50          строка баланса — всегда сверху (того же размера, что в магазине); на всю ширину
 *      1 2 3                 очередь занятий: три зоны — слева / по центру / справа (границы по столбцам кнопок, x = 133 и 263)
 *      🧬 💀 🩸              первый ряд кнопок занятий
 *      🤖 🧭 📖              второй ряд кнопок занятий
 *  Все области нажатия — строка баланса, три зоны очереди и шесть кнопок занятий.
 *  - Строка баланса: ДОЛГОЕ нажатие — вход в магазин и выход из него (в магазине это то же место наверху); обычное нажатие — автостарт очереди.
 *  - Кнопки занятий: обычное нажатие — запуск (эмодзи заменяется цифрами: минуты до конца промежутка), нажатие на цифры — СТОП (на телефон уходит
 *    пройденное время; запуск другого таймера останавливает прежний). ДОЛГОЕ нажатие — вызвать очередь, сохранённую в ячейке этой кнопки: текущая
 *    очередь заменяется шестью эмодзи ячейки; повторное долгое нажатие на ту же кнопку, пока в очереди ровно эти шесть, удваивает их (12);
 *    третье ничего не делает; долгое нажатие на другую кнопку заменяет очередь её ячейкой; пустая ячейка — ничего. Во время автостарта очередь не меняется.
 *  - Очередь, левая зона: долгое нажатие — режим ВВОДА очереди (кнопки занятий вводят по одному эмодзи; долгое нажатие на кнопку сохраняет введённое в её
 *    ячейку, только если ровно шесть эмодзи; выход — долгое нажатие на левую зону, введённая очередь становится текущей); обычное нажатие — тестовый режим
 *    вкл / выкл (все таймеры по 20 секунд; только когда ничего не идёт).
 *  - Очередь, центр: обычное нажатие — серый таймер (длится ценность 🩸); долгое нажатие — экран настройки ценности 🩸 (10–90 минут, только когда ничего
 *    не идёт). Во время ввода очереди обычное нажатие на центр добавляет в очередь 🏠.
 *  - Очередь, правая зона: обычное нажатие — журнал теста (нажатие на журнал — следующая страница); долгое — удалить очередь (во время ввода — сбросить
 *    введённое; во время автостарта очередь удалить нельзя).
 *  - Экран настройки ценности 🩸: сетка 3×3 (7 8 9 / 4 5 6 / 1 2 3), номер × 10 минут. Закрыть любой экран — долгое нажатие.
 *  - МАГАЗИН: сверху баланс 🌸 (его хранит телефон; часы берут баланс и цены у телефона при КАЖДОМ открытии магазина), ниже сетка 3×3:
 *      пусто 🌴 пусто / 🍚 🥤 🧁 / 🫦 👁️ 💬, под каждым товаром цена. Покупка — ДОЛГОЕ нажатие на товар (обычное ничего не делает). Нет цены / не хватает 🌸 /
 *      нет связи с телефоном — отказ (две короткие вибрации). Покупка уходит на телефон событием buy (повторяется, пока нет ack). 👁️ — обычная покупка.
 *      Закрыть магазин — долгое нажатие на строку баланса (или на пустое место).
 *  - ТАЙМЕР МАГАЗИНА 🌴 (1.20.0): один, по центру первой строки. Срока нет — считает время ВВЕРХ от запуска. Цена зависит от того, сколько он проработал за последний
 *    час: первые 10 минут бесплатно, блоки 10–20 — 1, 20–30 — 2, 30–40 — 2, 40–50 — 3, 50–60 — 3, дальше 3; блок оплачивается, когда начинается. Пока он идёт, вся строка
 *    закрашена (зелёный до 20 минут, жёлтый до 40, красный дальше; серый на паузе), на месте эмодзи — минуты чёрными цифрами. Нажатие на строку — пауза / продолжение,
 *    долгое — остановка. Не хватает 🌸 на следующий блок — таймер останавливается сам (вибрация). Запуск занятия, серого таймера или автостарта останавливает таймер.
 *  - Автостарт: запускается занятие, которое стоит в очереди первым; когда оно закончится, — следующее и так до конца очереди (и при
 *    погасшем экране). Остановка занятия автостарт выключает.
 *  - Очередь занятий живёт только на часах (до 12 значков; больше шести — два ряда, значки чуть меньше). В конце полного промежутка занятия
 *    самое левое такое занятие убирается из очереди; серый таймер по окончании убирает самый левый 🏠 / 🍀 / 🔍 (и час такого занятия уходит на телефон).
 *  - Серый таймер длится ценность 🩸 и идёт на весь экран (обычное нажатие — пауза 🩸, долгое — остановка).
 *  - Вибрация в режимах: короткая — добавлено занятие / загружена очередь; длиннее — вход, выход, сохранение, удаление, тест.
 *  - Баланс и цены приходят с телефона: при открытии магазина, при каждом включении экрана и в ответ на каждое событие, которое отправили часы (поле f).
 *    Постоянного опроса нет. Пока ответа нет, на главном экране показан последний известный баланс (серым).
 *  - Приложение можно закрыть кнопкой часов (на циферблат): таймеры и автостарт продолжают работать (всё считается по меткам времени, будильники
 *    будят службу и приложение в моменты окончания). Свайпы по-прежнему ничего не делают.
 *  - Системная полоска сверху (название и время, 64 px) скрывается (setStatusBarVisible), прокрутка страницы заблокирована
 *    (setScrollLock): весь экран 432×514 — рабочий, ничего не обрезается и не «тянется». Высоту рабочей области и показ полоски
 *    можно поменять на телефоне (LuvU613 5.12: ⚙️ -> «Вид на часах», поле v в ответе на sync); сохранённые настройки вида остаются в силе.
 *  - Очередь по центру экрана (по CX). Вибрация — как в версии 10: при погасшем экране вибрирует служба будильника (app-service/alarm.js),
 *    при включённом — страница (одна длинная сцена).
 */
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, widget, prop, align, text_style, setStatusBarVisible } from '@zos/ui'
import { setScrollLock } from '@zos/page'
import { replace } from '@zos/router'
import { getDeviceInfo } from '@zos/device'
import { Vibrator, VIBRATOR_SCENE_DURATION_LONG } from '@zos/sensor'
import * as sensor from '@zos/sensor'
import { setPageBrightTime, pauseDropWristScreenOff, setWakeUpRelaunch } from '@zos/display'
import { LocalStorage } from '@zos/storage'
import * as inter from '@zos/interaction'
import { set as alarmSet, cancel as alarmCancel } from '@zos/alarm'
import * as core from '../shared/core'
import * as lay from '../shared/layout'
import * as dlog from '../shared/dlog'
import { readFileSync, writeFileSync } from '@zos/fs'

const SEND_GAP = 15000        // как часто повторять отправку неподтверждённого события
const USE_ALARM = true        // будить приложение будильником, когда промежуток заканчивается при погасшем экране
const KEEP_AWAKE = true       // пока что-то идёт, не гасить экран
// Поля экрана (в координатах 432 px по ширине). Высоту рабочей области лучше менять на телефоне (⚙️ -> «Вид на часах»).
const SCREEN_W = 432
const LEFT = 8                // отступ слева
// размеры и места значков очереди (один ряд до 6 штук, два ряда до 12) — в shared/layout.js
const CELL = 120
const GAP = 10
const ZE = lay.zoneEdges(LEFT, CELL, GAP)   // границы левой / средней / правой зоны экрана (x = 133 и 263)
const QFULL = core.QUEUE_MAX  // сколько занятий помещается в очередь (12)
const Q2_SHIFT = 0            // сдвиг очереди из двух рядов по вертикали, px (минус — выше, плюс — ниже); один ряд не двигается
const SLOTS = core.COUNT      // сколько очередей можно сохранить: по одной на каждую из шести кнопок занятий
const SWIPE_EXIT_IDLE = false // true — когда ничего не идёт, свайп вправо выходит из приложения (как у обычных приложений часов)
// Горизонтальный центр видимой области: середина сетки (LEFT + 380/2). Цветные таймеры и магазин центруются по нему.
// Если время или сердечки «съезжают» вправо/влево — меняйте это число.
const CX = 198
const OV_W = CX * 2           // ширина части цветного экрана с цифрами (остаток справа — полоса того же цвета)
// Строка баланса (в магазине и на главном экране одинаковая, высота lay.BAL_H = 44 px), в магазине ниже — сетка 3×3 (значок 88 px и цена под ним)
const SH_ICON = 88
const SH_BAL_H = lay.BAL_H    // высота строки баланса (= размер маленького значка очереди)
const SH_GAP = 14             // отступ от строки баланса до сетки
const SH_STEP = 128           // шаг строк сетки (если экран ниже — уменьшается, см. shopGrid)
const SH_NUM = 40             // размер цифр баланса (и в магазине, и на главном экране)
const SH_PNUM = 22            // размер цифр цены
const SH_FAIL_MS = 12000      // ответа телефона нет столько — «нет связи»
// Экран настройки ценности 🩸: 🩸 (120 px), под ним 32 px зазора и подпись (90 px) — по центру экрана по высоте
const SET_BLOCK = 242
const SET_LABEL_DY = 152
const WHITE = 0xffffff
const BLACK = 0x000000
const BTN_BLACK = 0x050505
const RED = 0xff4517
const GREEN = 0x3bf76d
const GRAY = 0x8c8c8c
const YELLOW = 0xffd21f
// Таймер 🌴: вся строка закрашена (g — зелёный до 20 минут, p — жёлтый до 40, r — красный дальше, x — серый на паузе), цифры всегда одного цвета SH_FG
const SH_BG = { g: GREEN, p: YELLOW, r: RED, x: GRAY }
const SH_TONES = ['g', 'p', 'r', 'x']
const SH_FG = BLACK
const SH_TNUM = 64            // размер цифр таймера магазина (на месте эмодзи товара)
const SH_PAD = 8              // насколько закраска строки выходит выше и ниже цифр, px
// цвет серого и розового экранов на весь экран (таймер магазина — закрашенная строка в магазине, не на весь экран)
const PINK = 0xffbfe1
const OV_FG = { y: BLACK, a: WHITE }
const OV_BG = { y: GRAY, a: PINK }   // y — серый, a — розовый: идёт занятие из шести
const OV_ICON = 90          // эмодзи занятия под цифрами на сером / розовом экране (в полтора раза крупнее значка очереди, картинки o0..o8)
const OV_DIG_HALF = 40      // половина высоты цифр таймера (текст 110 px): от середины экрана до их нижнего края
const OV_KINDS = ['y', 'a']

// эмодзи занятий в порядке картинок i0..i8 / q0..q8 / m0..m8 (🧬 💀 🩸 🤖 🧭 📖 🏠 🍀 🔍); приложение-трекер на телефоне по эмодзи понимает занятие
const EMOJI = core.EMOJI

// Хранилище: если часы его не дают (нет разрешения и т.п.), работаем в памяти и показываем причину на экране
let ls = null
const mem = {}
const store = {
  getItem(k, d) {
    try { if (ls) { const v = ls.getItem(k, d); return v === undefined || v === null ? d : v } } catch (e) { fail('getItem ' + e) }
    return k in mem ? mem[k] : d
  },
  setItem(k, v) {
    mem[k] = v
    try { if (ls) ls.setItem(k, v) } catch (e) { fail('setItem ' + e) }
  }
}

// Ошибки показываем на экране (а не оставляем чёрный экран): без этого на часах их не увидеть
let failed = 0
function fail(msg) {
  failed++
  if (failed > 3) return
  try {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: 432, h: 514, color: 0x300000 })
    createWidget(widget.TEXT, {
      x: 12, y: 12 + (failed - 1) * 150, w: 408, h: 140, color: 0xffffff, text_size: 22,
      align_h: align.LEFT, align_v: align.TOP, text_style: text_style.WRAP, text: 'Ошибка ' + failed + ': ' + String(msg).slice(0, 160)
    })
  } catch (e) { /* больше показать нечем */ }
}
function guard(name, f) {
  try { return f() } catch (e) { fail(name + ': ' + e); return undefined }
}

let ST = null          // состояние (хранится): таймеры, очередь занятий, неотправленные события
let view = 'main'      // 'main' — занятия и очередь, 'settings' — ценность 🩸, 'shop' — магазин, 'ov' — цветной таймер на весь экран, 'log' — журнал вибрации
let vib = null
let inflight = false
let inflightAt = 0
let syncing = false
let syncAt = 0
let timer = null
let ticks = 0
let lastTickAt = 0     // когда был прошлый тик (разрыв больше трёх секунд — страница была «заморожена» при погасшем экране)
let lpAt = 0           // когда сработало долгое нажатие (чтобы отпускание пальца не считалось обычным нажатием)
let shown = []         // для каждого квадрата: показана ли кнопка идущего таймера
let lastLabel = []
let lastOv = ''
let lastQ = ''
let idle = []
let runb = []
let qb = []            // qb[k][e] — большой значок очереди (один ряд): место k, эмодзи e (у каждой пары своя кнопка с готовой картинкой)
let qs = []            // qs[k][e] — маленький значок очереди (два ряда): место k, эмодзи e
let qCx = []           // середина каждого стоящего на экране значка по x (нужно, чтобы понять, в какой зоне значок)
let zb = []            // три невидимые (чёрные) кнопки-зоны очереди: левая / центр / правая
let mbBtn = null       // невидимая (чёрная) кнопка строки баланса на главном экране: долгое нажатие — магазин, обычное — автостарт
let mbFl = null        // главный экран: значок 🌸 и цифры баланса
let mbTx = null
let shBalBtn = null    // то же место в магазине: долгое нажатие — выйти из магазина
let lastBal = ''
let lpBalAt = 0        // когда сработало долгое нажатие на строку баланса (отпускание пальца не должно считаться обычным нажатием)
let creating = false   // режим ввода очереди (долгое нажатие на левую зону очереди): кнопки занятий добавляют занятие в очередь, а не запускают таймер
let qDraft = []        // очередь, которую собирают (до QFULL эмодзи)
let slots = []         // сохранённые очереди (SLOTS штук, по одной на кнопку занятия); в каждой — ровно шесть эмодзи или пусто
let lpTopAt = 0        // когда сработало долгое нажатие на зону очереди (отпускание пальца не должно считаться обычным нажатием)
let lpTopZone = -1     // в какой зоне очереди оно было (нажатие в другой зоне сразу после него — настоящее, не отпускание)
let lpShopAt = 0        // когда сработало долгое нажатие на товар магазина (отпускание пальца не должно ставить таймер на паузу)
let lpCell = -1        // на какой кнопке занятия было долгое нажатие и когда (отпускание пальца не должно считаться нажатием)
let lpCellAt = 0
let shBg = null        // магазин: чёрный фон, баланс (значок 🌸 и цифры), семь товаров (кнопка + значок + цена)
let shFl = null
let shBal = null
let shCell = []
let shIcon = []
let shPf = []
let shPr = []
let shTimer = null     // цифры таймера магазина на месте эмодзи товара (картинка товара при этом спрятана)
let shBand = {}        // закрашенная строка таймера магазина: по одной кнопке на цвет (g / p / r / x); нажатие и долгое нажатие — как на самом таймере
let shBuyAt = 0        // когда запущен таймер магазина (долгое нажатие сразу после запуска не должно его останавливать)
let shLink = 'wait'    // связь с телефоном при этом открытии магазина: 'wait' — ждём ответ, 'ok' — баланс и цены свежие, 'fail' — нет связи (не продаём)
let shOpenAt = 0
let lastSh = ''
let me = null          // страница (нужна обработчикам жестов)
let sBg = null
let sA = []            // девять невидимых областей нажатия на экране ценности: сетка 3×3 (7 8 9 / 4 5 6 / 1 2 3), номер × 10 минут
let sEmoji = null
let sLabel = null
let lgBg = null        // экран журнала вибрации: чёрный фон и строки текста (по одной кнопке на строку)
let lgRows = []
let lgPage = 0         // страница журнала (0 — самые новые записи)
let lgPages = 1
let lastLg = ''
const LG_ROWS = 14     // строк на экране журнала: сверху итог, ниже записи
const LG_H = 30        // высота строки журнала, px
let ov = { y: null, a: null }
let ovS = { y: null, a: null }
let ovBot = []         // ovBot[e] — эмодзи идущего занятия под цифрами на сером / розовом экране (картинка, нажатия проходят сквозь неё)
let lastOvI = ''
let ovShownKind = ''   // какой цветной экран сейчас показан (при смене серого на розовый и обратно экран перекладывается)   // полоса справа от цифр (чтобы цвет закрывал весь экран)
let launch = ''        // с каким параметром открыта страница ('alarm' — разбудил будильник)
let G = null           // геометрия
let ROW = 171          // высота одной из трёх строк экрана (нужна экрану настройки ценности)
let L = null           // места главного экрана (lay.mainRows): баланс, очередь, два ряда кнопок и области нажатия
let LV = { h: 0, hide: 1, vib: 1, y0: 0, y1: 0, y2: 0 }   // вид с телефона: h — высота рабочей области (0 — по размеру экрана), hide — скрыть полоску сверху,
                       // vib — вибрировать при включённом экране, y0/y1/y2 — сдвиг строк (очередь / 🤿🎨🩸 / 📖🧬💀) по вертикали, px
// Положение экрана. Система считает верхние 64 px «полоской» (она скрыта, но страница всё равно начинается ниже), поэтому из 514 px
// на экране видны только 450: нижние 64 обрезаются. Два способа:
//  LIFT = 0  — рабочая высота 450 (всё помещается, верхние 64 px пустые). Проверенный вариант.
//  LIFT = 64 — рабочая высота 514, всё поднято на 64 px вверх (y < 0), чтобы занять и верхние 64 px. Пробный вариант: если часы не рисуют
//              и не принимают нажатия выше начала страницы, верх экрана будет обрезан — тогда вернуть 0.
//
// ===== ВОТ ЭТО ЧИСЛО МЕНЯТЬ, ЧТОБЫ ДВИГАТЬ ВЕСЬ ЭКРАН ПО ВЕРТИКАЛИ =====
// DOWN — на сколько пикселей опустить весь экран от полностью поднятого положения (LIFT = 64).
//   Сверху обрезано — ставьте БОЛЬШЕ (опускает экран вниз). Обрезано снизу — ставьте МЕНЬШЕ (поднимает вверх).
//   0 — как в v16.1-lift64 (поднято на все 64 px), 64 — как обычный архив (LIFT = 0, рабочая высота 450). Допустимо от 0 до 64.
const DOWN = 33
const LIFT = 64 - DOWN
const WORK_H = 450
const DY = -LIFT
let layV = 0           // счётчик перекладок экрана (чтобы очередь и магазин перерисовались на новых местах)

function cur() { return ST }

function save() {
  try {
    store.setItem('st', JSON.stringify(ST))
  } catch (e) { /* без сохранения продолжаем работать */ }
}

/** Команда вибромотору. Возвращает 'ok' или 'E:причина' (причина идёт в журнал). */
function vibrate(mode) {
  try {
    if (!vib) vib = new Vibrator()
    vib.start({ mode: mode })
    return 'ok'
  } catch (e) {
    try { vib.setMode({ mode: mode }); vib.start(); return 'ok2' } catch (e2) { return 'E:' + String(e2).slice(0, 24) }
  }
}

// Журнал вибрации и будильников (см. shared/dlog.js): страница пишет в lg_p.txt, служба — в lg_s.txt; смотреть на экране журнала
// (обычное нажатие на правую зону очереди).
const LOG_P = 'lg_p.txt'
const LOG_S = 'lg_s.txt'
function readLogFile(path) {
  try {
    const s = readFileSync({ path: path, options: { encoding: 'utf8' } })
    return typeof s === 'string' ? s : ''
  } catch (e) { return '' }
}
function plog(text) {
  try { writeFileSync({ path: LOG_P, data: dlog.append(readLogFile(LOG_P), Date.now(), text, dlog.LOG_MAX), options: { encoding: 'utf8' } }) } catch (e) { /* журнал не критичен */ }
}
function clearLogs() {
  try { writeFileSync({ path: LOG_P, data: '', options: { encoding: 'utf8' } }) } catch (e) { /* не критично */ }
  try { writeFileSync({ path: LOG_S, data: '', options: { encoding: 'utf8' } }) } catch (e) { /* не критично */ }
}

/** Начало нового теста: запись «T start» в журнал (сводка считает срабатывания службы после последней такой записи). Только в тестовом режиме
 *  и только если после запуска что-то действительно идёт. */
function markTest(now) {
  if (!ST.test || !core.anyRunning(cur())) return
  plog('T start ' + Math.round(core.fullMs(cur()) / 1000) + 's')
}

/** Вибрация страницы (экран включён): одна длинная сцена, как в версии 10. Если на телефоне выключено — молчим.
 *  При погасшем экране вибрирует служба будильника (app-service/alarm.js) — её этот переключатель не касается. */
function signalHour() {
  if (!LV.vib) { plog('PV off'); return }
  plog('PV ' + vibrate(VIBRATOR_SCENE_DURATION_LONG))
}

/** Короткий отклик в режимах очереди: 'tick' — добавлено занятие / загружена очередь, 'mode' — вход, выход, сохранение, случайная, удаление.
 *  Если нужной вибрации в системе нет или на телефоне выключена вибрация часов — молчим. */
function feedback(kind) {
  if (!LV.vib) return
  const m = kind === 'tick' ? sensor.VIBRATOR_SCENE_SHORT_LIGHT : sensor.VIBRATOR_SCENE_DURATION
  if (m === undefined) return
  vibrate(m)
}

/** Системная полоска сверху и прокрутка: полоска скрыта (если телефон не сказал иначе), прокрутка заблокирована. */
function applyBar() {
  try { setStatusBarVisible(!LV.hide) } catch (e) { /* не квадратный экран — полоски нет */ }
  try { setScrollLock({ lock: true }) } catch (e) { /* не критично */ }
}

function loadView() {
  try {
    const raw = store.getItem('vw', '')
    if (raw) LV = lay.cleanView(JSON.parse(raw))
  } catch (e) { /* вид по умолчанию: весь экран, полоска скрыта */ }
}

function geometry() {
  const base = LIFT ? lay.FULL_H : WORK_H
  let h = base
  try {
    const d = getDeviceInfo()
    if (d && d.height > 0) h = Math.min(d.height, base)
  } catch (e) { /* значения по умолчанию */ }
  if (LV.h > 0) h = LV.h   // высоту задал телефон (⚙️ -> «Вид на часах»)
  // ширина всегда 432 (designWidth приложения): реальная ширина экрана могла быть больше и уводила сетку за край
  ROW = lay.rowH(h)
  L = lay.mainRows(h, LV.y0, LV.y1, LV.y2)
  return { w: SCREEN_W, h: h, cell: CELL, font: Math.round(CELL * 0.5) }
}

/** Куда ставить блок экрана настройки: 🩸 и подпись под ним — по центру по высоте. */
function setTop() { return lay.centerTop(G.h, SET_BLOCK) }
/** Верх строки баланса: сверху экрана, и на главном экране, и в магазине (см. lay.mainRows). */
function shopBalY() { return L.balY }

/** Сетка магазина: верх и шаг строк (шаг уменьшается, если рабочая область ниже обычной). */
function shopGrid() {
  const top = shopBalY() + SH_BAL_H + SH_GAP
  const step = Math.max(100, Math.min(SH_STEP, Math.floor((G.h - 6 - top) / 3)))
  return { top: top, step: step }
}

/** Ячейка товара i: x, y и высота (кнопка закрывает значок и цену). */
function shopCellXY(i) {
  const g = shopGrid()
  const pos = core.SHOP_POS[i]   // ячейка сетки 3×3, в которой стоит товар (🌴 — по центру первой строки)
  return { x: LEFT + (pos % 3) * (CELL + GAP), y: g.top + Math.floor(pos / 3) * g.step, h: Math.min(SH_ICON + 32, g.step - 2) }
}

/** Кнопка занятия i: ряд 0 — первый ряд кнопок, ряд 1 — второй (места — lay.mainRows). */
function cellXY(i) {
  const c = i % 3
  const r = Math.floor(i / 3)
  return { x: LEFT + c * (CELL + GAP), y: r === 0 ? L.b1 : L.b2 }
}

/** Зона очереди (0 — левая, 1 — центр, 2 — правая): между строкой баланса и первым рядом кнопок, по столбцам кнопок. */
function zoneRect(c) {
  const a = c === 0 ? 0 : ZE[c - 1]
  const b = c === 2 ? G.w : ZE[c]
  return { x: a, y: L.qArea.y, w: b - a, h: L.qArea.h }
}

/** Область экрана настройки ценности: строка r (0 — верхняя, 1 — средняя, 2 — нижняя треть экрана) и столбец c (те же три столбца, что у зон очереди). */
function areaRect(r, c) {
  const a = c === 0 ? 0 : ZE[c - 1]
  const b = c === 2 ? G.w : ZE[c]
  const y0 = r * ROW
  const y1 = r === 2 ? G.h : (r + 1) * ROW
  return { x: a, y: y0, w: b - a, h: y1 - y0 }
}

function setBtn(b, x, y, w, h, text, color) {
  try { b.setProperty(prop.MORE, { x: x, y: y + DY, w: w, h: h, text: text, color: color }) } catch (e) { /* не критично */ }
}

function setVisible(b, v) {
  try { if (b) b.setProperty(prop.VISIBLE, v) } catch (e) { /* не критично */ }
}

/** Переставить кнопку (картинку не трогаем: её часы не обновляют). */
function moveBtn(b, x, y, w, h) {
  try { if (b) b.setProperty(prop.MORE, { x: x, y: y + DY, w: w, h: h }) } catch (e) { /* не критично */ }
}

/** Очередь, которую сейчас показываем: собираемая (во время создания) или текущая. */
function shownQueue() {
  if (view === 'ov') return core.ovTop(ST)   // серый / розовый экран: остаток очереди либо 🔄 и эмодзи моно-занятия — на месте очереди
  return creating ? qDraft : ST.queue
}

/** Значки очереди (только на главном экране): до 6 — один ряд побольше, 7–12 — два ряда поменьше (места считает shared/layout.js).
 *  Картинку на кнопке менять нельзя (часы её не обновляют — все значки были 🤿), поэтому у каждого места есть по кнопке на каждое эмодзи,
 *  а показывается одна. */
function renderQueue() {
  const items = shownQueue()
  const key = view + '|' + items.join(',') + '|' + layV
  if (key === lastQ) return
  lastQ = key
  const vis = []
  for (let k = 0; k < items.length && vis.length < QFULL; k++) {
    const idx = items[k] === core.LOOP ? 9 : EMOJI.indexOf(items[k])   // 9 — значок 🔄 (q9.png)
    if (idx >= 0) vis.push(idx)
  }
  const places = lay.queuePlaces(vis.length, CX, L.qTop + (vis.length > lay.Q_ONE_MAX ? Q2_SHIFT : 0))
  const big = vis.length <= lay.Q_ONE_MAX
  qCx = []
  for (let j = 0; j < places.length; j++) qCx.push(places[j].x + places[j].s / 2)
  for (let j = 0; j < QFULL; j++) {
    for (let e = 0; e <= 9; e++) {
      const on = (view === 'main' || view === 'ov') && j < vis.length && e === vis[j]
      const bb = qb[j] && qb[j][e]
      const sb = qs[j] && qs[j][e]
      if (on) {
        const pl = places[j]
        moveBtn(big ? bb : sb, pl.x, pl.y, pl.s, pl.s)
      }
      setVisible(bb, on && big)
      setVisible(sb, on && !big)
    }
  }
}

function saveSlots() {
  try { store.setItem('qsl6', JSON.stringify(slots)) } catch (e) { /* не критично */ }
}

function saveDraft() {
  try {
    store.setItem('qc', creating ? '1' : '0')
    store.setItem('qd', JSON.stringify(qDraft))
  } catch (e) { /* не критично */ }
}

/** Ответ телефона с балансом и ценами (поле f): запоминаем (источник правды — телефон) и перерисовываем магазин. false — в ответе нет f. */
function takeShop(f) {
  const before = ST.fb + '|' + JSON.stringify(ST.fp)
  if (!core.setShopFrom(ST, f)) return false
  if (before !== ST.fb + '|' + JSON.stringify(ST.fp)) save()
  shLink = 'ok'
  if (view === 'shop') renderShop(Date.now())
  else if (view === 'main') renderBal()
  return true
}

/** Подпись цены: значок 🌸 и цифры по центру ячейки; нет цены — ничего. */
function shopPriceAt(i, price) {
  const p = shopCellXY(i)
  if (price === null) { setVisible(shPf[i], false); setVisible(shPr[i], false); return }
  const txt = String(price)
  const tw = txt.length * Math.round(SH_PNUM * 0.56) + 4
  const x0 = p.x + Math.round((CELL - (22 + 3 + tw)) / 2)
  const y = p.y + SH_ICON + 2
  setVisible(shPf[i], true)
  setVisible(shPr[i], true)
  moveBtn(shPf[i], x0, y + 3, 22, 22)
  setBtn(shPr[i], x0 + 25, y, tw, 28, txt, WHITE)
}

/** Строка баланса на главном экране (всегда сверху): значок 🌸 и цифры того же размера, что в магазине. Белые — баланс свежий (телефон ответил),
 *  серые — последний известный (ответа ещё нет); баланса нет совсем — серое «...». Перерисовывается, только если что-то поменялось. */
function renderBal() {
  const on = view === 'main'
  const bal = on ? core.shopBalance(ST) : null
  const key = on ? 'on|' + bal + '|' + shLink + '|' + layV : 'off'
  if (key === lastBal) return
  lastBal = key
  setVisible(mbBtn, on)
  if (!on) { setVisible(mbFl, false); setVisible(mbTx, false); return }
  const y = L.balY
  const txt = bal === null ? '...' : String(bal)
  const tw = txt.length * Math.round(SH_NUM * 0.56) + 6
  const x0 = CX - Math.round((SH_BAL_H + 4 + tw) / 2)
  setVisible(mbFl, true)
  setVisible(mbTx, true)
  moveBtn(mbFl, x0, y, SH_BAL_H, SH_BAL_H)
  setBtn(mbTx, x0 + SH_BAL_H + 4, y, tw, SH_BAL_H, txt, bal !== null && shLink === 'ok' ? WHITE : GRAY)
}

/** Магазин: сверху баланс 🌸 (или «нет связи» / «…»), ниже сетка 3×3 с ценами. Перерисовывается, только если что-то поменялось. */
function renderShop(now) {
  const on = view === 'shop'
  const t = now || Date.now()
  let key = on ? 'on' : 'off'
  if (on) {
    const prices = []
    for (let i = 0; i < core.SHOP.length; i++) prices.push(core.shopPrice(ST, i, t))
    const sh = ST.sh
    key += '|' + shLink + '|' + core.shopBalance(ST) + '|' + prices.join(',') + '|' + layV + '|' + (sh ? sh.i + ':' + core.shopLabel(ST, t) + ':' + (sh.run > 0 ? core.shopTone(ST, t) : 'x') : '-')
  }
  if (key === lastSh) return
  lastSh = key
  setVisible(shBg, on)
  const tm = on ? ST.sh : null
  for (let i = 0; i < shCell.length; i++) { setVisible(shCell[i], on); setVisible(shIcon[i], on && !(tm && tm.i === i)) }
  if (!on) {
    setVisible(shTimer, false)
    for (const k of SH_TONES) setVisible(shBand[k], false)
    setVisible(shFl, false)
    setVisible(shBal, false)
    for (let i = 0; i < shPf.length; i++) { setVisible(shPf[i], false); setVisible(shPr[i], false) }
    return
  }
  const bal = core.shopBalance(ST)
  const y = shopBalY()
  if (shLink === 'fail' || (bal === null)) {
    setVisible(shFl, false)
    setVisible(shBal, true)
    setBtn(shBal, CX - 140, y, 280, SH_BAL_H, shLink === 'fail' ? 'нет связи' : '...', shLink === 'fail' ? RED : WHITE)
  } else {
    const txt = String(bal)
    const tw = txt.length * Math.round(SH_NUM * 0.56) + 6
    const x0 = CX - Math.round((SH_BAL_H + 4 + tw) / 2)
    setVisible(shFl, true)
    setVisible(shBal, true)
    moveBtn(shFl, x0, y, SH_BAL_H, SH_BAL_H)
    setBtn(shBal, x0 + SH_BAL_H + 4, y, tw, SH_BAL_H, txt, shLink === 'ok' ? WHITE : GRAY)
  }
  for (let i = 0; i < core.SHOP.length; i++) shopPriceAt(i, tm && tm.i === i ? null : core.shopPrice(ST, i, t))
  // таймер магазина: вся строка закрашена цветом (зелёный / жёлтый / красный по времени, серый на паузе), на месте эмодзи — минуты чёрными цифрами; цена не показывается
  setVisible(shTimer, !!tm)
  const tone = tm ? (tm.run > 0 ? core.shopTone(ST, t) : 'x') : ''
  for (const k of SH_TONES) setVisible(shBand[k], k === tone)
  if (tm) {
    const p = shopCellXY(tm.i)
    moveBtn(shBand[tone], 0, p.y - SH_PAD, G.w, SH_ICON + 2 * SH_PAD)
    setBtn(shTimer, p.x, p.y, CELL, SH_ICON, core.shopLabel(ST, t), SH_FG)
  }
}

/** Переключить экран: показать нужные виджеты, остальные спрятать. */
function enterView(v) {
  view = v
  for (let i = 0; i < core.COUNT; i++) { setVisible(idle[i], false); setVisible(runb[i], false) }
  shown = []
  lastLabel = []
  lastOv = ''
  lastQ = ''
  lastSh = ''
  lastBal = ''
  renderQueue()
  renderShop()
  renderBal()
  setVisible(shBalBtn, v === 'shop')
  for (let c = 0; c < zb.length; c++) setVisible(zb[c], v === 'main')
  setVisible(sBg, v === 'settings')
  for (let i = 0; i < sA.length; i++) setVisible(sA[i], v === 'settings')
  setVisible(sEmoji, v === 'settings')
  setVisible(sLabel, v === 'settings')
  lastLg = ''
  setVisible(lgBg, v === 'log')
  for (let r = 0; r < lgRows.length; r++) setVisible(lgRows[r], v === 'log')
  const k = v === 'ov' ? core.overlayKind(cur()) : ''
  ovShownKind = k
  lastOvI = ''
  for (const c of OV_KINDS) { setVisible(ov[c], k === c); setVisible(ovS[c], k === c) }
  renderOvIcons()
}

/** Перерисовать то, что поменялось. */
function render(now) {
  const st = cur()
  if (view === 'main') {
    for (let i = 0; i < core.COUNT; i++) {
      const isRun = core.running(st, i)
      const mode = isRun ? 'r' : 'i'
      if (shown[i] !== mode) {
        setVisible(idle[i], mode === 'i')
        setVisible(runb[i], mode === 'r')
        shown[i] = mode
        lastLabel[i] = ''
      }
      if (mode === 'r') {
        const text = core.label(st, core.remaining(st, i, now))
        if (text !== lastLabel[i]) {
          const p = cellXY(i)
          setBtn(runb[i], p.x, p.y, G.cell, G.cell, text, WHITE)
          lastLabel[i] = text
        }
      }
    }
    renderBal()
  } else if (view === 'shop') {
    if (shLink === 'wait' && now - shOpenAt > SH_FAIL_MS) shLink = 'fail'   // телефон не ответил
    renderShop(now)
  } else if (view === 'log') {
    renderLog()
  } else if (view === 'ov') {
    const k = core.overlayKind(st)
    const text = core.clock(core.ovLeftAny(st, now))
    if (k + text !== lastOv && ov[k]) {
      setBtn(ov[k], 0, 0, OV_W, G.h, text, OV_FG[k])
      lastOv = k + text
    }
    renderOvIcons()
  }
}

/** Серый и розовый экран: под цифрами — эмодзи того, что идёт сейчас (над цифрами — очередь или 🔄 + эмодзи, это рисует renderQueue). */
function renderOvIcons() {
  const k = view === 'ov' ? core.overlayKind(ST) : ''
  const e = k === 'y' || k === 'a' ? core.activeIdx(ST) : -1
  const key = k + '|' + e + '|' + layV
  if (key === lastOvI) return
  lastOvI = key
  for (let j = 0; j < EMOJI.length; j++) setVisible(ovBot[j], j === e)
  if (e >= 0 && ovBot[e]) {
    // по центру между нижним краем цифр и нижним краем экрана (низ нижнего ряда кнопок)
    const y = Math.round((Math.round(G.h / 2) + OV_DIG_HALF + L.b2 + CELL - OV_ICON) / 2)
    moveBtn(ovBot[e], CX - Math.round(OV_ICON / 2), y, OV_ICON, OV_ICON)
  }
}

/** Экран журнала: сверху итог (сколько раз сработала служба-будильник / ошибок / открытий страницы и номер страницы журнала),
 *  ниже записи службы и страницы вперемешку по времени, новые сверху. Зелёные — служба, белые — страница, красные — ошибки. */
function renderLog() {
  const per = LG_ROWS - 2   // самая верхняя строка на часах не видна (скрыта углом экрана) — под записи она не годится (раньше в ней пропадала самая новая запись)
  const entries = dlog.merge(dlog.parse(readLogFile(LOG_S)), dlog.parse(readLogFile(LOG_P)))
  const last = entries.length ? entries[entries.length - 1].t : 0
  const key = entries.length + '|' + last + '|' + lgPage
  if (key === lastLg) return
  lastLg = key
  const sm = dlog.summary(entries)
  if (lgPage < 0) {
    const sh = dlog.sheet(entries)
    if (!sh.items.length) { lgPage = 0; lastLg = ''; renderLog(); return }   // сводки нет — сразу записи
    renderSheet(sh, sm, per)
    return
  }
  const pg = dlog.pageOf(entries, lgPage, per)
  lgPage = pg.page
  lgPages = pg.pages
  // итог — в самой нижней строке (верхняя строка на часах не видна), записи — выше, новые сверху
  setBtn(lgRows[LG_ROWS - 1], 0, 4 + (LG_ROWS - 1) * LG_H, G.w, LG_H, 'S' + sm.s + ' err' + sm.e + ' P' + sm.p + '  ' + (pg.page + 1) + '/' + pg.pages, 0xffd24a)
  setBtn(lgRows[0], 0, 4, G.w, LG_H, '', BLACK)
  for (let r = 0; r < per; r++) {
    const row = pg.rows[r]
    const color = !row ? BLACK : row.kind === 'err' ? RED : row.kind === 'svc' ? GREEN : WHITE
    setBtn(lgRows[r + 1], 0, 4 + (r + 1) * LG_H, G.w, LG_H, row ? row.text : '', color)
  }
}

/** Страница-сводка последнего теста: номер срабатывания службы + буква (A — вибрация, «.» — тихая граница, c — тихая + проверка часов), по шесть в ряд. Её удобно сверять с
 *  записью «да / нет» по номерам: один снимок вместо нескольких страниц журнала. */
function renderSheet(sh, sm, per) {
  const LEG = ['A вибрация   . тихо   c тихо+часы', 'B C D — запасные способы вибрации', '! ошибка  ? службу прибили при C']
  const rows = dlog.sheetRows(sh.items, 6)
  const room = per - 1 - LEG.length   // первая строка — шапка, внизу — легенда
  setBtn(lgRows[LG_ROWS - 1], 0, 4 + (LG_ROWS - 1) * LG_H, G.w, LG_H, 'S' + sm.s + ' err' + sm.e + ' P' + sm.p + '  сводка', 0xffd24a)
  const head = (sh.since ? 'тест с ' + dlog.stamp(sh.since) + ', ' : '') + 'срабатываний: ' + sh.items.length
  setBtn(lgRows[0], 0, 4, G.w, LG_H, '', BLACK)
  setBtn(lgRows[1], 0, 4 + LG_H, G.w, LG_H, head, WHITE)
  for (let r = 1; r < per; r++) {   // r — строка внутри области записей (0 — шапка)
    let text = ''
    let color = GREEN
    if (r - 1 < rows.length && r - 1 < room) text = rows[r - 1]
    else if (r >= per - LEG.length) { text = LEG[r - (per - LEG.length)]; color = WHITE }
    setBtn(lgRows[r + 1], 0, 4 + (r + 1) * LG_H, G.w, LG_H, text, color)
  }
}

function openLog() {
  lgPage = -1   // первой показывается сводка последнего теста (если её нет — сразу записи)
  enterView('log')
  lastLg = ''
  renderLog()
}

function closeLog() {
  enterView('main')
  render(Date.now())
}

/** Нажатие на журнал: следующая страница (более старые записи), после последней — снова самые новые. */
function nextLog() {
  lgPage = lgPage + 1 >= lgPages ? -1 : lgPage + 1   // после последней страницы записей — снова сводка
  lastLg = ''
  renderLog()
}

function updateValLabel() {
  setBtn(sLabel, CX - 170, setTop() + SET_LABEL_DY, 340, 90, ST.val + ' мин', WHITE)
}

/** Поставить на места всё, что зависит от высоты рабочей области (после смены вида на телефоне). */
function applyLayout() {
  G = geometry()
  layV++
  for (let i = 0; i < core.COUNT; i++) { const p = cellXY(i); moveBtn(idle[i], p.x, p.y, G.cell, G.cell) }
  for (let c = 0; c < zb.length; c++) { const z = zoneRect(c); moveBtn(zb[c], z.x, z.y, z.w, z.h) }
  moveBtn(mbBtn, 0, L.balArea.y, G.w, L.balArea.h)
  moveBtn(shBalBtn, 0, L.balArea.y, G.w, L.balArea.h)
  // экран настройки
  moveBtn(sBg, 0, 0, G.w, G.h)
  for (let i = 0; i < sA.length; i++) { const a = areaRect(Math.floor(i / 3), i % 3); moveBtn(sA[i], a.x, a.y, a.w, a.h) }
  moveBtn(sEmoji, CX - 60, setTop(), 120, 120)
  moveBtn(sLabel, CX - 170, setTop() + SET_LABEL_DY, 340, 90)
  // магазин
  moveBtn(shBg, 0, 0, G.w, G.h)
  for (let i = 0; i < shCell.length; i++) {
    const p = shopCellXY(i)
    moveBtn(shCell[i], p.x, p.y, CELL, p.h)
    moveBtn(shIcon[i], p.x + Math.round((CELL - SH_ICON) / 2), p.y, SH_ICON, SH_ICON)
  }
  if (core.SHOP.length) { const p0 = shopCellXY(0); for (const k of SH_TONES) moveBtn(shBand[k], 0, p0.y - SH_PAD, G.w, SH_ICON + 2 * SH_PAD) }
  // журнал
  moveBtn(lgBg, 0, 0, G.w, G.h)
  for (let r = 0; r < lgRows.length; r++) moveBtn(lgRows[r], 0, 4 + r * LG_H, G.w, LG_H)
  // цветные таймеры
  for (const c of OV_KINDS) { moveBtn(ov[c], 0, 0, OV_W, G.h); moveBtn(ovS[c], OV_W, 0, G.w - OV_W, G.h) }
  lastLabel = []
  lastOv = ''
  lastQ = ''
  lastSh = ''
  lastBal = ''
  lastOvI = ''
  if (view === 'settings') updateValLabel()
  renderQueue()
  renderShop()
  renderBal()
  render(Date.now())
}

/** Перезапуск страницы (после смены «скрывать полоску»: рабочая область меняется, всё кладётся заново). */
function reloadPage() {
  try {
    const o = { url: 'page/index' }
    if (launch) o.param = launch
    replace(o)
  } catch (e) { applyLayout() }
}

/** Вид с телефона: { h, hide, vib, y0, y1, y2 }. Сохраняем и применяем; что не поменялось — не трогаем. */
function setView(v) {
  if (!v) return
  const nv = lay.cleanView(v)
  const barChanged = nv.hide !== LV.hide
  const layoutChanged = nv.h !== LV.h || nv.y0 !== LV.y0 || nv.y1 !== LV.y1 || nv.y2 !== LV.y2
  if (!barChanged && !layoutChanged && nv.vib === LV.vib) return
  LV = nv
  try { store.setItem('vw', JSON.stringify(nv)) } catch (e) { /* не критично */ }
  if (!barChanged && !layoutChanged) return   // поменялась только вибрация — перекладывать нечего
  applyBar()
  if (barChanged) reloadPage()
  else applyLayout()
}

function openSettings() {
  enterView('settings')
  updateValLabel()
}

function closeSettings() {
  save()
  enterView('main')
  render(Date.now())
}

/** Открыть магазин: показываем последний известный баланс и цены и сразу спрашиваем телефон; продаём только после его ответа (shLink = 'ok'). */
function openShop() {
  shLink = 'wait'
  shOpenAt = Date.now()
  enterView('shop')
  if (me) { try { me.syncPhone(true) } catch (e) { /* не критично */ } }
}

function closeShop() {
  enterView('main')
  render(Date.now())
}

/** Нажатие на область экрана настройки: ценность = номер области (7 8 9 / 4 5 6 / 1 2 3) × 10 минут. */
function setValArea(r, c) {
  ST.val = core.areaVal(r, c)
  save()
  updateValLabel()
}

/** Будильники на моменты окончания: разбудят службу (вибрация) и приложение, если экран погас.
 *  Ставим только то, чего ещё нет, и снимаем то, что больше не нужно (план — core.alarmPlan: служба на несколько ближайших границ вперёд,
 *  страница на самую ближайшую; отказ системы повторяется на секунду позже — core.applyAlarms). Раньше при каждом открытии страницы
 *  все будильники снимались и ставились заново, и новый будильник мог встать на ту же секунду, что и будильник, который ставила сама
 *  служба, — тогда система отказывала, а старый молча выходил по «поколению»: вибрация пропадала. Теперь служба ничего не ставит и никуда
 *  не «выходит», а отмена идёт по номерам будильников. */
function scheduleAlarms(now) {
  if (!USE_ALARM) return
  let old = []
  try { old = JSON.parse(store.getItem('alarms', '[]')) } catch (e) { old = [] }
  const r = core.applyAlarms(cur(), now, old, {
    set: (url, param, delay) => alarmSet({ url: url, param: param, delay: delay }),
    cancel: (id) => alarmCancel(id)
  })
  try { store.setItem('alarms', JSON.stringify(r.next)) } catch (e) { /* не критично */ }
  if (r.plan.length || old.length) {
    // коротко: сколько будильников поставлено заново (+), сколько уже стояло (=), сколько система отказала (X, с причиной первого отказа)
    let add = 0
    let kept = 0
    let bad = 0
    let why = ''
    for (let k = 0; k < r.tok.length; k++) {
      const x = r.tok[k]
      if (x.charAt(x.length - 1) === '=') kept++
      else if (x.indexOf(':X') > 0) { bad++; if (!why) why = ' ' + x.slice(x.indexOf(':X') + 2, x.length - 1) }
      else add++
    }
    plog(r.tok.length ? 'A +' + add + ' =' + kept + ' X' + bad + why : 'A off')
  }
}

function keepAwake() {
  if (!KEEP_AWAKE || !core.anyRunning(cur())) return
  try { setPageBrightTime({ brightTime: 120000 }) } catch (e) { /* не критично */ }
  try { pauseDropWristScreenOff({ duration: 600000 }) } catch (e) { /* не критично */ }
}

/** Свайпы ничего не открывают и не закрывают (всё делается нажатиями), и из приложения свайпом выйти нельзя: свайп гасится всегда
 *  (SWIPE_EXIT_IDLE = true — когда ничего не идёт и открыт главный экран, свайп вправо выходит, как у обычных приложений часов).
 *  Из приложения выходят кнопкой часов (на циферблат): её приложение больше не перехватывает, и таймеры при этом продолжают идти.
 *  true — «система, не обрабатывай». */
function onSwipe(e) {
  if (view !== 'main' || creating || core.anyRunning(cur())) return true
  return !SWIPE_EXIT_IDLE
}

/** Гасим свайпы (true — «система, не обрабатывай»). Кнопки часов не трогаем: можно выйти на циферблат, таймеры продолжат работать. */
function blockExit() {
  try {
    inter.onGesture({
      callback: function (e) {
        const swipe = e === inter.GESTURE_RIGHT || e === inter.GESTURE_LEFT || e === inter.GESTURE_UP || e === inter.GESTURE_DOWN
        if (!swipe) return false
        return guard('жест', () => onSwipe(e))
      }
    })
  } catch (e) { /* без обработки жестов */ }
}

/** Сообщение телефону для события из очереди отправки. */
function payloadFor(ev) {
  if (ev.k === 'q') {
    if (ev.i !== undefined) return { t: 'done', id: ev.id, e: EMOJI[ev.i], ts: ev.ts }   // серый таймер убрал 🏠 / 🍀 / 🔍: час такого занятия
    return { t: 'qtap', id: ev.id, ts: ev.ts }                                           // событие из старых версий
  }
  if (ev.k === 'qr') return { t: 'qlog', id: ev.id, ts: ev.ts, v: ev.v, q: ev.q, m: ev.m, d: ev.d, x: ev.x ? 1 : 0 }   // записанная очередь целиком (закончена или удалена): второй слой журнала на телефоне
  if (ev.k === 'mo') return { t: 'mlog', id: ev.id, ts: ev.ts, v: ev.v, e: EMOJI[ev.i], n: ev.n, x: ev.x ? 1 : 0 }   // моно-занятие (запуск нажатием): n полных промежутков по v минут, второй слой журнала на телефоне
  if (ev.k === 'p') return { t: 'buy', id: ev.id, e: ev.e, c: ev.c, ts: ev.ts }   // покупка в магазине: цена, по которой купили
  if (ev.k === 'b') return { t: 'blood', id: ev.id, e: EMOJI[ev.i], ts: ev.ts, ms: ev.ms, f: ev.f ? 1 : 0 }   // и шесть занятий, и серый таймер (🏠🍀🔍): минуты ценности 🩸
  return { t: 'done', id: ev.id, e: EMOJI[ev.i], ts: ev.ts }   // событие старого вида (из прошлых версий)
}

Page(
  BasePage({
    onInit(p) {
      try { if (!ls) ls = new LocalStorage() } catch (e) { /* ошибка покажется в build */ }
      launch = typeof p === 'string' ? p : ''
      loadView()
      applyBar()   // полоска скрывается до построения экрана, чтобы страница сразу получила весь экран
    },

    build() {
      me = this
      guard('старт', () => { ls = new LocalStorage() })
      loadView()
      applyBar()
      G = guard('экран', geometry)
      guard('открытие', () => setWakeUpRelaunch({ relaunch: true }))   // при включении экрана открывается это приложение
      ST = guard('состояние', () => core.restore(store.getItem('st', ''), false, 60)) || core.newState(false, 60)
      // один раз: очередь, которая раньше приходила с телефона (и хранилась отдельно), становится очередью часов
      if (store.getItem('qmig', '') !== '1') {
        try { if (!ST.queue.length) ST.queue = core.cleanQueue(JSON.parse(store.getItem('qq', '[]'))) } catch (e) { /* пусто */ }
        try { store.setItem('qmig', '1') } catch (e) { /* не критично */ }
      }
      // ячейки очередей: по одной на кнопку занятия; ключ 'qsl6' — новый (эмодзи занятий поменялись, старые ячейки не годятся)
      slots = []
      for (let k = 0; k < SLOTS; k++) slots.push([])
      try {
        const sv = JSON.parse(store.getItem('qsl6', '[]'))
        for (let k = 0; k < SLOTS; k++) {
          const q = core.cleanQueue(sv[k])
          slots[k] = q.length === core.SLOT_LEN ? q : []
        }
      } catch (e) { /* пустые ячейки */ }
      // очередь, которую собирали, когда приложение закрылось (экран гаснет — приложение откроется заново): продолжаем с того же места
      creating = store.getItem('qc', '0') === '1'
      qDraft = []
      try {
        const d = JSON.parse(store.getItem('qd', '[]'))
        for (let k = 0; k < d.length && qDraft.length < QFULL; k++) qDraft.push(String(d[k]))
      } catch (e) { qDraft = [] }
      blockExit()
      plog('P open ' + (launch || '-'))
      shown = []
      lastLabel = []
      idle = []
      runb = []
      qb = []
      zb = []
      sA = []

      // строка баланса (чёрная кнопка на всю ширину, под значком 🌸 и цифрами): долгое нажатие — магазин, обычное — автостарт очереди
      guard('строка баланса', () => {
        mbBtn = createWidget(widget.BUTTON, {
          x: 0, y: L.balArea.y + DY, w: G.w, h: L.balArea.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: () => { guard('баланс', () => this.balTap()) },
          longpress_func: () => { guard('баланс', () => this.balLong()) }
        })
        setVisible(mbBtn, false)
        mbFl = createWidget(widget.IMG, { x: CX - 40, y: L.balY + DY, w: SH_BAL_H, h: SH_BAL_H, src: 'fl.png', enable: false })
        mbTx = createWidget(widget.TEXT, {
          x: CX, y: L.balY + DY, w: 80, h: SH_BAL_H, text: '', text_size: SH_NUM, color: WHITE,
          align_h: align.LEFT, align_v: align.CENTER_V, enable: false
        })
        setVisible(mbFl, false)
        setVisible(mbTx, false)
      })

      // серый и розовый экраны на весь экран (тап — пауза 🩸 и возврат); долгое нажатие — выход. Создаются ДО значков очереди: значки очереди должны стоять поверх них.
      // Цифры стоят по центру CX (чуть левее середины экрана), справа полоса того же цвета.
      const makeOv = (kind) => {
        guard('таймер ' + kind, () => {
          const exit = () => { guard('выход', () => this.ovExit()) }
          const tap = () => { guard('пауза', () => this.ovTap()) }
          const b = createWidget(widget.BUTTON, {
            x: 0, y: 0, w: OV_W, h: G.h, text: '', text_size: 110, color: OV_FG[kind],
            normal_color: OV_BG[kind], press_color: OV_BG[kind], radius: 0,
            click_func: tap,
            longpress_func: exit
          })
          const strip = createWidget(widget.BUTTON, {
            x: OV_W, y: 0, w: G.w - OV_W, h: G.h, text: '',
            normal_color: OV_BG[kind], press_color: OV_BG[kind], radius: 0,
            click_func: tap,
            longpress_func: exit
          })
          setVisible(b, false)
          setVisible(strip, false)
          ov[kind] = b
          ovS[kind] = strip
        })
      }
      makeOv('y')
      makeOv('a')

      // очередь — три зоны (чёрные кнопки под значками): слева — долгое: ввод очереди (повторно — выход), обычное: тестовый режим;
      // по центру — обычное: серый таймер, долгое: настройка ценности 🩸; справа — обычное: журнал теста, долгое: удалить очередь.
      for (let c = 0; c < 3; c++) {
        const cc = c
        guard('зона ' + c, () => {
          const z = zoneRect(c)
          const b = createWidget(widget.BUTTON, {
            x: z.x, y: z.y, w: z.w, h: z.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
            click_func: () => { guard('очередь', () => this.queueTap(cc)) },
            longpress_func: () => { guard('очередь', () => this.queueLong(cc)) }
          })
          setVisible(b, false)
          zb.push(b)
        })
      }

      // значки очереди: значки-кнопки стоят поверх зон, нажатие и долгое нажатие на значок работают как на его зоне.
      // На каждое место по кнопке на каждое эмодзи (картинка на кнопке не меняется), показывается нужная. 🍀 в очередь не попадает.
      // qb — большие значки (один ряд, до 6), qs — маленькие (два ряда, до 12).
      qs = []
      const mk = (src, size, k, e, store2, ix) => {
        guard('очередь ' + k + '/' + e, () => {
          const b = createWidget(widget.BUTTON, {
            x: LEFT, y: 0, w: size, h: size, text: '', normal_src: src + e + '.png', press_src: src + e + '.png',
            click_func: () => { guard('очередь', () => this.queueIconTap(ix)) },
            longpress_func: () => { guard('очередь', () => this.queueIconLong(ix)) }
          })
          setVisible(b, false)
          store2[k][e] = b
        })
      }
      for (let k = 0; k < lay.Q_ONE_MAX; k++) {
        qb.push([])
        for (let e = 0; e < EMOJI.length; e++) if (e !== 7) mk('q', lay.Q_SIZE, k, e, qb, k)
      }
      for (let k = 0; k < QFULL; k++) {
        qs.push([])
        for (let e = 0; e < EMOJI.length; e++) if (e !== 7) mk('m', lay.Q2_SIZE, k, e, qs, k)
      }
      mk('q', lay.Q_SIZE, 0, 9, qb, 0)   // 🔄 (q9.png): первое место очереди из двух значков на экране моно-занятия
      // эмодзи идущего занятия под цифрами на сером / розовом экране (поверх экрана, но нажатия проходят сквозь него)
      ovBot = []
      for (let e = 0; e < EMOJI.length; e++) {
        if (e === 7) { ovBot.push(null); continue }
        guard('значок ' + e, () => {
          const im = createWidget(widget.IMG, { x: CX - Math.round(OV_ICON / 2), y: 0, w: OV_ICON, h: OV_ICON, src: 'o' + e + '.png', enable: false })
          setVisible(im, false)
          ovBot.push(im)
        })
      }

      for (let i = 0; i < core.COUNT; i++) {
        const k = i
        guard('кнопка ' + i, () => {
          const p = cellXY(i)
          idle.push(createWidget(widget.BUTTON, {
            x: p.x, y: p.y, w: G.cell, h: G.cell, text: '', normal_src: 'i' + i + '.png', press_src: 'i' + i + '.png',
            click_func: () => { guard('нажатие', () => this.cellTap(k)) },
            longpress_func: () => { guard('долгое', () => this.cellLong(k)) }
          }))
          // идущий таймер: только цифры на чёрном, эмодзи полностью скрыто
          const rb = createWidget(widget.BUTTON, {
            x: p.x, y: p.y, w: G.cell, h: G.cell, text: '60', text_size: G.font, color: WHITE,
            normal_color: BTN_BLACK, press_color: 0x1c1c1c, radius: 0,
            click_func: () => { guard('нажатие', () => this.cellTap(k)) },
            longpress_func: () => { guard('долгое', () => this.cellLong(k)) }
          })
          setVisible(rb, false)
          runb.push(rb)
        })
      }

      // экран настройки ценности 🩸: чёрный фон, 🩸 по центру, снизу ценность. Экран разделён на сетку 3×3 (7 8 9 / 4 5 6 / 1 2 3):
      // нажатие на область ставит ценность «номер × 10 минут» (1 — 10, 5 — 50, 9 — 90), долгое нажатие закрывает экран.
      // 🩸 и подпись — только картинка и текст (enable: false), нажатия проходят сквозь них на области под ними.
      guard('настройка', () => {
        const close = () => { guard('закрыть', () => { lpAt = Date.now(); closeSettings() }) }
        sBg = createWidget(widget.BUTTON, {
          x: 0, y: 0, w: G.w, h: G.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: () => {}, longpress_func: close
        })
        sA = []
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const rr = r
            const cc = c
            const a = areaRect(r, c)
            const ab = createWidget(widget.BUTTON, {
              x: a.x, y: a.y, w: a.w, h: a.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
              click_func: () => { guard('ценность', () => setValArea(rr, cc)) }, longpress_func: close
            })
            setVisible(ab, false)
            sA.push(ab)
          }
        }
        sEmoji = createWidget(widget.IMG, { x: CX - 60, y: setTop(), w: 120, h: 120, src: 'i2.png', enable: false })
        sLabel = createWidget(widget.TEXT, {
          x: CX - 170, y: setTop() + SET_LABEL_DY, w: 340, h: 90, text: '60 мин', text_size: 56, color: WHITE,
          align_h: align.CENTER_H, align_v: align.CENTER_V, enable: false
        })
        setVisible(sBg, false)
        setVisible(sEmoji, false)
        setVisible(sLabel, false)
      })

      // магазин: чёрный фон, сверху баланс (значок 🌸 и цифры), ниже семь товаров — кнопка (долгое нажатие = покупка), значок и цена (значок и цена —
      // только картинка и текст с enable: false, нажатия проходят на кнопку). Обычное нажатие ничего не делает, долгое на строке баланса (или на пустом месте) закрывает.
      guard('магазин', () => {
        const none = () => { /* обычное нажатие ничего не делает */ }
        const close = () => { guard('закрыть', () => { lpAt = Date.now(); closeShop() }) }
        shBg = createWidget(widget.BUTTON, {
          x: 0, y: 0, w: G.w, h: G.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: none, longpress_func: close
        })
        setVisible(shBg, false)
        shBalBtn = createWidget(widget.BUTTON, {
          x: 0, y: L.balArea.y + DY, w: G.w, h: L.balArea.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: none, longpress_func: () => { guard('закрыть', () => { lpAt = Date.now(); lpBalAt = lpAt; closeShop() }) }
        })
        setVisible(shBalBtn, false)
        shCell = []
        shIcon = []
        shPf = []
        shPr = []
        for (let i = 0; i < core.SHOP.length; i++) {
          const k = i
          const p = shopCellXY(i)
          const cb = createWidget(widget.BUTTON, {
            x: p.x, y: p.y, w: CELL, h: p.h, text: '', normal_color: BLACK, press_color: 0x1c1c1c, radius: 0,
            click_func: () => { guard('таймер', () => this.shopTap(k)) }, longpress_func: () => { guard('покупка', () => this.shopLong(k)) }
          })
          setVisible(cb, false)
          shCell.push(cb)
        }
        for (let i = 0; i < core.SHOP.length; i++) {
          const p = shopCellXY(i)
          const ic = createWidget(widget.IMG, { x: p.x + Math.round((CELL - SH_ICON) / 2), y: p.y, w: SH_ICON, h: SH_ICON, src: 'sh' + i + '.png', enable: false })
          setVisible(ic, false)
          shIcon.push(ic)
          const pf = createWidget(widget.IMG, { x: p.x, y: p.y + SH_ICON + 5, w: 22, h: 22, src: 'fs.png', enable: false })
          setVisible(pf, false)
          shPf.push(pf)
          const pr = createWidget(widget.TEXT, {
            x: p.x, y: p.y + SH_ICON + 2, w: 40, h: 28, text: '', text_size: SH_PNUM, color: WHITE,
            align_h: align.LEFT, align_v: align.CENTER_V, enable: false
          })
          setVisible(pr, false)
          shPr.push(pr)
        }
        // закрашенная строка запущенного таймера: по кнопке на каждый цвет, на всю ширину; нажатие — пауза, долгое — остановка (как на самом таймере)
        const p0 = shopCellXY(0)
        for (const k of SH_TONES) {
          const bb = createWidget(widget.BUTTON, {
            x: 0, y: p0.y - SH_PAD, w: G.w, h: SH_ICON + 2 * SH_PAD, text: '', normal_color: SH_BG[k], press_color: SH_BG[k], radius: 0,
            click_func: () => { guard('таймер', () => this.shopTap(0)) }, longpress_func: () => { guard('покупка', () => this.shopLong(0)) }
          })
          setVisible(bb, false)
          shBand[k] = bb
        }
        shTimer = createWidget(widget.TEXT, {
          x: 0, y: 0, w: CELL, h: SH_ICON, text: '', text_size: SH_TNUM, color: SH_FG,
          align_h: align.CENTER_H, align_v: align.CENTER_V, enable: false
        })
        setVisible(shTimer, false)
        shFl = createWidget(widget.IMG, { x: CX - 40, y: shopBalY(), w: SH_BAL_H, h: SH_BAL_H, src: 'fl.png', enable: false })
        shBal = createWidget(widget.TEXT, {
          x: CX, y: shopBalY(), w: 80, h: SH_BAL_H, text: '', text_size: SH_NUM, color: WHITE,
          align_h: align.LEFT, align_v: align.CENTER_V, enable: false
        })
        setVisible(shFl, false)
        setVisible(shBal, false)
      })

      // экран журнала вибрации: чёрный фон и LG_ROWS строк (каждая — отдельная кнопка с одной строкой текста); нажатие — следующая страница,
      // долгое нажатие — закрыть
      guard('журнал', () => {
        const next = () => { guard('журнал', nextLog) }
        const close = () => { guard('закрыть', () => { lpAt = Date.now(); closeLog() }) }
        lgBg = createWidget(widget.BUTTON, {
          x: 0, y: 0, w: G.w, h: G.h, text: '', normal_color: BLACK, press_color: BLACK, radius: 0,
          click_func: next, longpress_func: close
        })
        setVisible(lgBg, false)
        lgRows = []
        for (let r = 0; r < LG_ROWS; r++) {
          const b = createWidget(widget.BUTTON, {
            x: 0, y: 4 + r * LG_H, w: G.w, h: LG_H, text: '', text_size: 18, color: WHITE,
            normal_color: BLACK, press_color: BLACK, radius: 0, click_func: next, longpress_func: close
          })
          setVisible(b, false)
          lgRows.push(b)
        }
      })


      guard('экран старта', () => enterView(core.overlayKind(cur()) ? 'ov' : 'main'))
      if (DY) guard('сдвиг вверх', applyLayout)   // всё, что создано по обычным местам, поднимается на LIFT
      applyBar()   // ещё раз после построения: прокрутка заблокирована при любом размере содержимого
      const now = Date.now()
      guard('запуск', () => this.settle(core.process(cur(), now), now))   // то, что закончилось, пока приложение было закрыто
      if (launch === 'alarm') { try { setPageBrightTime({ brightTime: 20000 }) } catch (e) { /* не критично */ } }
      guard('телефон', () => this.syncPhone())   // при каждом включении экрана приложение открывается заново — это и есть обновление данных
      timer = setInterval(() => { guard('секунда', () => this.tick()) }, 1000)
    },

    onDestroy() {
      if (timer) { clearInterval(timer); timer = null }
      save()
    },

    /** Всё, что нужно сделать после любого изменения состояния. */
    settle(res, now) {
      if (res.events.length || res.ovDone) plog('E ' + res.events.length + (res.fresh || res.ovFresh ? ' fresh' : ' old'))
      if (res.fresh) signalHour()
      if (res.ovDone && res.ovFresh) signalHour()          // конец цветного таймера — та же вибрация, что в конце занятия
      // экран следует за состоянием: закончившийся цветной таймер закрывается сам (приложение остаётся), а автостарт может перейти
      // с занятия на серый таймер (🏠 / 🔍 в очереди) и обратно
      const ok = core.overlayKind(cur())
      if (view === 'ov' && !ok) enterView('main')
      else if (view === 'main' && ok) enterView('ov')
      else if (view === 'ov' && ok !== ovShownKind) enterView('ov')   // серый <-> розовый (пауза 🩸 и возврат)
      save()
      scheduleAlarms(now)
      keepAwake()
      renderQueue()   // в конце промежутка занятие убирается из очереди
      render(now)
      this.sendDue(now)
    },

    tick() {
      const now = Date.now()
      if (lastTickAt && now - lastTickAt > 3000) plog('W gap ' + Math.round((now - lastTickAt) / 1000) + 's')
      lastTickAt = now
      ticks++
      if (ticks % 2 === 0) { try { store.setItem('hb', String(now)) } catch (e) { /* метка нужна только журналу */ } }   // служба по ней видит, как давно «спят» часы
      const res = core.process(cur(), now)
      if (res.events.length || res.ovDone || res.shop) {
        this.settle(res, now)
      } else {
        render(now)
        this.sendDue(now)
        if (ticks % 60 === 0) keepAwake()   // постоянного опроса телефона нет: очередь и подарки обновляются при включении экрана (см. build)
      }
    },

    /** Обычное нажатие на кнопку занятия. Режим ввода очереди: добавляет её эмодзи в очередь; иначе запуск / стоп таймера. */
    cellTap(i) {
      const now = Date.now()
      if (now - lpAt < 800 || view !== 'main') return
      if (i === lpCell && now - lpCellAt < 2000) return   // отпускание пальца после долгого нажатия на этой же кнопке
      if (creating) { this.addToQueue(EMOJI[i]); return }   // при вводе очереди кнопки занятий добавляют занятие в очередь
      const wasIdle = !core.anyRunning(cur())
      this.settle(core.toggle(cur(), i, now), now)
      if (wasIdle) markTest(now)
    },

    /** Долгое нажатие на кнопку занятия [i]. Обычный режим: вызвать очередь из ячейки этой кнопки (см. loadSlot). Режим ввода очереди: сохранить введённую
     *  очередь в ячейку этой кнопки (только если в ней ровно шесть эмодзи). Экран при этом не меняется, поэтому другие нажатия не теряются. */
    cellLong(i) {
      const now = Date.now()
      lpCell = i
      lpCellAt = now
      if (view !== 'main') return
      if (creating) { this.saveSlot(i); return }
      this.loadSlot(i)
    },

    /** Нажатие / долгое нажатие на значок очереди: то же, что на зону, в которой он стоит. */
    queueIconTap(k) {
      if (view === 'ov') { this.ovTap(); return }   // значки очереди на сером / розовом экране — часть экрана
      const cx = qCx[k]
      if (cx === undefined) return
      this.queueTap(lay.zoneOf(cx, ZE))
    },

    queueIconLong(k) {
      if (view === 'ov') { this.ovExit(); return }
      const cx = qCx[k]
      if (cx === undefined) return
      this.queueLong(lay.zoneOf(cx, ZE))
    },

    /** Обычное нажатие на строку баланса: автостарт очереди (только когда ничего не идёт; не во время ввода очереди). */
    balTap() {
      const now = Date.now()
      if (view !== 'main' || creating || now - lpAt < 800 || now - lpBalAt < 2000) return   // отпускание пальца после долгого нажатия не считается нажатием
      if (core.anyRunning(cur())) return
      this.autoStart()
    },

    /** Долгое нажатие на строку баланса: вход в магазин (выход из него — то же место, см. shBalBtn). Во время ввода очереди не работает. */
    balLong() {
      const now = Date.now()
      lpBalAt = now
      lpAt = now
      if (view !== 'main' || creating) return
      openShop()
    },

    /** Обычное нажатие на зону очереди: слева (0) — тестовый режим вкл / выкл, по центру (1) — серый таймер, справа (2) — журнал теста.
     *  Режим ВВОДА очереди: центр добавляет в очередь 🏠 (его время идёт серым таймером — и при ручном запуске, и в автостарте), остальное молчит. */
    queueTap(c) {
      const now = Date.now()
      if (view !== 'main' || (c === lpTopZone && now - lpTopAt < 2000)) return   // отпускание пальца после долгого нажатия на этой же зоне не считается нажатием
      if (creating) { if (c === 1) this.addToQueue(EMOJI[6]); return }
      if (c === 0) { this.toggleTest(); return }
      if (c === 1) { this.startOv('y'); return }
      openLog()
    },

    /** Долгое нажатие на зону очереди: слева (0) — войти в режим ввода очереди / выйти из него, по центру (1) — настройка ценности 🩸 (только когда ничего
     *  не идёт), справа (2) — удалить очередь (во время ввода — сбросить введённое). */
    queueLong(c) {
      if (view !== 'main') return
      lpTopAt = Date.now()
      lpTopZone = c
      if (c === 0) { if (creating) this.finishQueue(); else this.beginQueue(); return }
      if (creating) {
        if (c === 2) { qDraft = []; saveDraft(); renderQueue(); feedback('mode') }
        return
      }
      if (c === 1) { if (!core.anyRunning(cur())) openSettings(); return }
      this.deleteQueue()
    },

    /** Войти в режим ввода очереди (только когда ничего не идёт). Текущая очередь остаётся, пока вводят новую. */
    beginQueue() {
      if (core.anyRunning(cur())) return
      creating = true
      qDraft = []
      saveDraft()
      renderQueue()
      render(Date.now())
      feedback('mode')
    },

    addToQueue(e) {
      if (!creating || qDraft.length >= QFULL) return
      qDraft.push(e)
      saveDraft()
      renderQueue()
      feedback('tick')
    },

    /** Выйти из режима ввода: введённая очередь остаётся на экране как текущая (и сохраняется на часах). Если ничего не введено — текущая
     *  очередь не меняется. */
    finishQueue() {
      creating = false
      const q = core.cleanQueue(qDraft)
      if (q.length) { core.setQueue(ST, q, Date.now()); save(); this.sendDue(Date.now()) }
      qDraft = []
      saveDraft()
      renderQueue()
      feedback('mode')
    },

    /** Режим ввода, долгое нажатие на кнопку занятия [i]: введённая очередь сохраняется в её ячейку — только если эмодзи ровно шесть
     *  (пять или семь — ничего не сохраняется и вибрации нет). Введённое остаётся на экране — можно сохранить и в другую ячейку. */
    saveSlot(i) {
      if (!creating || qDraft.length !== core.SLOT_LEN) return
      slots[i] = core.cleanQueue(qDraft)
      if (slots[i].length !== core.SLOT_LEN) { slots[i] = []; return }
      saveSlots()
      feedback('mode')
    },

    /** Долгое нажатие на кнопку занятия [i] в обычном режиме: вызвать очередь, сохранённую в её ячейке (core.slotQueue). Очередь пуста или стоит другая —
     *  она заменяется шестью эмодзи ячейки; в очереди ровно эти шесть — удваиваются (12); уже удвоено — ничего. Пустая ячейка — ничего (и без вибрации).
     *  Во время автостарта очередь не меняется: он идёт по ней. */
    loadSlot(i) {
      if (ST.auto) return
      const q = core.slotQueue(ST.queue, slots[i])
      if (!q) return
      core.setQueue(ST, q, Date.now())
      save()
      this.sendDue(Date.now())
      renderQueue()
      feedback('tick')
    },

    /** Удалить текущую очередь (не во время автостарта: он идёт по этой очереди). */
    deleteQueue() {
      if (ST.auto) return
      core.setQueue(ST, [], Date.now())   // начатая очередь закрывается: что выполнено, уходит телефону записью
      save()
      this.sendDue(Date.now())
      renderQueue()
      feedback('mode')
    },

    /** Автостарт очереди: запускается занятие, которое стоит в очереди первым; дальше — по порядку, до конца очереди. */
    autoStart() {
      const now = Date.now()
      if (!ST.queue.length) return
      const wasIdle = !core.anyRunning(cur())
      this.settle(core.startAuto(cur(), now), now)
      if (wasIdle) markTest(now)
    },

    /** Тестовый режим: все таймеры по 20 секунд (на кнопках — секунды), телефону уходит полная ценность 🩸. Только когда ничего не идёт. */
    toggleTest() {
      if (!core.toggleTest(cur())) return
      lastLabel = []
      if (ST.test) clearLogs()   // новый тест — журнал с чистого листа
      save()
      feedback('mode')
    },

    startOv(kind) {
      const now = Date.now()
      const wasIdle = !core.anyRunning(cur())
      const res = core.startOverlay(cur(), kind, now)
      enterView('ov')
      this.settle(res, now)
      if (wasIdle) markTest(now)
    },

    /** Обычное нажатие на серый / розовый экран: временная пауза 🩸 и возврат (core.tapOverlay). Красный, жёлтый, зелёный — ничего. */
    ovTap() {
      const now = Date.now()
      if (view !== 'ov' || now - lpAt < 800) return
      const k = core.overlayKind(cur())
      if (k !== 'a' && k !== 'y') return
      const r = core.tapOverlay(cur(), now)
      this.settle(r.res, now)
      if (r.changed) feedback('tick')
    },

    ovExit() {
      const now = Date.now()
      lpAt = now
      const r = core.stopAll(cur(), now)   // занятие и серый шлют пройденное время (и замороженное при паузе 🩸 тоже); купленные красный, жёлтый и зелёный ничего не шлют
      enterView('main')
      this.settle(r.res, now)
    },

    /** Обычное нажатие на таймер магазина (на его товар): пауза / продолжение. На остальных товарах ничего не делает. */
    shopTap(i) {
      const now = Date.now()
      if (view !== 'shop' || !ST.sh || ST.sh.i !== i || now - lpAt < 800 || now - lpShopAt < 2000) return   // отпускание пальца после долгого нажатия не считается нажатием
      const r = core.shopTap(ST, now)
      this.settle(r.res, now)
      if (r.ok) { feedback('tick'); lastSh = ''; renderShop(now) }
    },

    /** Долгое нажатие на товар [i] в магазине. Таймер магазина этого товара уже есть — остановка (списанное остаётся).
     *  Иначе покупка (см. core.shopBuy). Отказ — две короткие вибрации и ничего не списывается. */
    shopLong(i) {
      const now = Date.now()
      lpShopAt = now
      if (view !== 'shop') return
      if (ST.sh && ST.sh.i === i) {
        if (now - shBuyAt < 2000) return   // это ещё то же долгое нажатие, которым таймер запустили
        const r = core.shopStop(ST, now)
        plog('M stop ' + i + ' b' + r.blocks)
        feedback('mode')
        lastSh = ''
        this.settle(r.res, now)
        renderShop(now)
        return
      }
      const r = core.shopBuy(cur(), i, now, shLink === 'ok')
      if (!r.ok) {
        plog('M no ' + r.why)
        feedback('tick')
        setTimeout(() => { feedback('tick') }, 220)
        this.settle(r.res, now)
        return
      }
      plog('M buy ' + i + ' c' + (r.ev ? r.ev.c : 0))
      feedback('mode')
      lastSh = ''
      if (core.SHOP[i].timer) shBuyAt = now
      this.settle(r.res, now)
      renderShop(now)
    },

    /** Спросить у телефона баланс и цены 🌸 (и вид экрана, если телефон его присылает). Очередь занятий с телефоном больше не сверяется. */
    syncPhone(force) {
      const now = Date.now()
      if (!force && syncing && now - syncAt < 30000) return
      syncing = true
      syncAt = now
      this.request({ method: 'u613.send', params: { t: 'sync' } })
        .then((res) => {
          syncing = false
          const r = res && res.ok ? res.reply : null
          const got = !!(r && r.f && takeShop(r.f))
          if (!got && view === 'shop' && shLink === 'wait') { shLink = 'fail'; renderShop(Date.now()) }   // старый LuvU613 (нет поля f) или нет связи
          if (r && r.v) guard('вид', () => setView(r.v))
        })
        .catch(() => { syncing = false; if (view === 'shop' && shLink === 'wait') { shLink = 'fail'; renderShop(Date.now()) } })
    },

    /** Отправить телефону одно неподтверждённое событие (по одному за раз). */
    sendDue(now) {
      if (inflight && now - inflightAt < 30000) return
      const owner = ST
      const d = core.due(owner, now, SEND_GAP)
      if (!d.length) return
      const target = d[0]
      target.tried = now
      inflight = true
      inflightAt = now
      const id = target.id
      this.request({ method: 'u613.send', params: payloadFor(target) })
        .then((res) => {
          inflight = false
          const r = res && res.ok ? res.reply : null
          // сначала подтверждение (событие уходит из очереди), потом свежий баланс: иначе подтверждённая покупка вычлась бы дважды
          if (r && r.t === 'ack' && r.id === id) { core.ack(owner, id); save() }
          if (r && r.f) takeShop(r.f)
          if (r && r.v) guard('вид', () => setView(r.v))
          if (r && r.t === 'ack' && r.id === id) this.sendDue(Date.now())
        })
        .catch(() => { inflight = false })
    }
  })
)
