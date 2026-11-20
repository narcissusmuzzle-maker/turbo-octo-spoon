// Прогон настоящего page/index.js на заглушках API часов: строка баланса на главном экране, вход в магазин / выход из него долгим нажатием на неё,
// покупки, отказы, нет связи, таймер 🌴 (закрашенная строка и счёт минут вверх, цена по блокам, пауза), вызов очереди из ячейки долгим нажатием на кнопки, нажатия по зонам очереди.
// Запуск: node --import ./tests/register.mjs tests/page.test.mjs   (из папки приложения)
import assert from 'node:assert'

let n = 0
async function t(name, f) { await f(); n++; console.log('ok  ' + name) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = () => globalThis.__W.filter((w) => w.alive)
const shown = () => alive().filter((w) => w.visible)
const buttons = () => shown().filter((w) => w.type === 'BUTTON')
const texts = () => shown().filter((w) => w.type === 'TEXT').map((w) => w.props.text)
const imgs = () => shown().filter((w) => w.type === 'IMG').map((w) => w.props.src)
// время страницы можно «перематывать»: Date.now() сдвигается на skew (иначе пять минут не дождаться)
let skew = 0
const realNow = Date.now
Date.now = () => realNow() + skew
const band = () => buttons().find((w) => w.props.w === 432 && w.props.h < 200 && [0x3bf76d, 0xffd21f, 0xff4517, 0x8c8c8c].includes(w.props.normal_color))   // закрашенная строка таймера магазина
const shTxt = () => shown().find((w) => w.type === 'TEXT' && w.props.text_size === 64 && w.props.text !== '')   // цифры таймера магазина
const press = (w) => w.props.click_func()
const hold = (w) => w.props.longpress_func()
const byImg = (src) => buttons().find((w) => w.props.normal_src === src)
// строка баланса (чёрная кнопка на всю ширину, невысокая): на главном экране и в магазине — своя, видна всегда одна из них
const balBtn = () => buttons().find((w) => w.props.w === 432 && w.props.h < 200 && w.props.text === '')
// три зоны очереди (чёрные кнопки без картинки, не 120 и не 432 шириной), слева направо
const zoneBtn = (c) => buttons().filter((w) => w.props.normal_color === 0 && w.props.text === '' && w.props.w < 432 && w.props.w !== 120 && !w.props.normal_src).sort((a, b) => a.props.x - b.props.x)[c]
// значки очереди на экране: номера эмодзи в порядке чтения (сверху вниз, слева направо)
const queueNow = () => buttons().filter((w) => /^[qm]\d\.png$/.test(String(w.props.normal_src))).sort((a, b) => a.props.y - b.props.y || a.props.x - b.props.x).map((w) => +String(w.props.normal_src)[1])
const runBtn = () => buttons().find((w) => w.props.normal_color === 0xffbfe1 && w.props.w === 396)   // розовый экран: идёт занятие из шести
const cellOf = (i) => globalThis.__W.filter((w) => w.type === 'BUTTON' && w.props.w === 120 && w.props.normal_color === 0 && w.props.press_color === 0x1c1c1c && w.props.text === '')[i]

// телефон 5.18: баланс b, цены p, получено событий
const phone = { online: true, f: true, b: 50, p: { '🍿': 12, '🌴': 30, '🍚': 5, '🥤': 7, '👁️': 0 }, got: [], buys: {} }
const fobj = () => ({ b: phone.b, p: phone.p })
globalThis.__REQ = (p) => {
  phone.got.push(p)
  if (!phone.online) return Promise.reject(new Error('offline'))
  if (p.t === 'sync') return Promise.resolve({ ok: true, reply: phone.f ? { t: 'sync', f: fobj(), g: { n: 0, h: 0 } } : { t: 'sync', g: { n: 3, h: 1 } } })
  if (p.t === 'buy') {
    if (!phone.buys[p.id]) { phone.buys[p.id] = true; phone.b -= p.c }   // повтор того же id ничего не меняет
    return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: fobj(), g: { n: 0, h: 0 } } })
  }
  return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, f: fobj(), g: { n: 0, h: 0 } } })
}
globalThis.Page = (o) => { globalThis.__PAGE = o }
await import('../page/index.js')
const page = globalThis.__PAGE
const buysSent = () => phone.got.filter((p) => p.t === 'buy')

await t('запуск: главный экран и магазин построены, подарков нет, цветных экранов на весь экран нет', async () => {
  page.onInit()
  page.build()
  await sleep(20)
  assert.equal(globalThis.__STATUSBAR, false)
  assert.equal(byImg('i1.png') !== undefined, true)            // 💀 на месте
  assert.equal(alive().some((w) => String(w.props.normal_src || w.props.src) === 'g.png' || String(w.props.normal_src || w.props.src) === 'h.png'), false)
  assert.equal(shown().filter((w) => w.type === 'BUTTON' && [0xffd21f, 0xff4517, 0x3bf76d].includes(w.props.normal_color)).length, 0)   // красного, жёлтого и зелёного экранов нет (строка таймера магазина спрятана, пока таймер не идёт)
})

await t('главный экран: баланс 🌸 виден сразу (значок и цифры), долгое нажатие на кнопки при пустых ячейках и на 💀 ничего не делает, магазин открывается долгим нажатием на строку баланса', async () => {
  assert.equal(imgs().includes('fl.png'), true)
  assert.equal(texts().includes('50'), true)
  for (let i = 0; i < 6; i++) hold(byImg('i' + i + '.png'))      // ячейки пусты — ничего; 💀 больше не магазин
  await sleep(10)
  assert.equal(imgs().includes('sh0.png'), false)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x3bf76d), false)
  assert.equal(buttons().some((w) => w.props.normal_color === 0xff4517), false)
  assert.equal(queueNow().length, 0)
  press(balBtn())                                                // обычное нажатие на строку баланса при пустой очереди: ничего
  await sleep(10)
  assert.equal(runBtn(), undefined)
  hold(balBtn())
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), true)
  for (let i = 0; i < 7; i++) assert.equal(imgs().includes('sh' + i + '.png'), true)   // семь товаров
  assert.equal(imgs().includes('fl.png'), true)
})

await t('при открытии: баланс и цены берутся у телефона (sync), показаны 🌸50 и цены; у 🌴 — 0 (правило часов, а не цена телефона), у товара без цены подписи нет', async () => {
  assert.equal(phone.got.filter((p) => p.t === 'sync').length >= 2, true)   // при старте страницы и при открытии магазина
  const tx = texts()
  assert.equal(tx.includes('50'), true)
  assert.equal(tx.includes('12'), false)     // цена 🍿 от телефона: такого товара больше нет
  assert.equal(tx.includes('30'), false)     // и цена 🌴 от телефона не используется
  assert.equal(tx.includes('5'), true)       // 🍚
  assert.equal(tx.includes('7'), true)       // 🥤
  assert.equal(tx.includes('0'), true)       // 🌴 (первые 10 минут бесплатно) и 👁️ с ценой 0
  const priceFl = alive().filter((w) => w.type === 'IMG' && w.props.src === 'fs.png' && w.visible).length
  assert.equal(priceFl, 4)                   // 🌴 🍚 🥤 👁️; у 🧁 🫦 💬 цены нет
})

await t('обычное нажатие на товар ничего не покупает; долгое — покупка: событие buy, баланс 50 -> 45 после ack', async () => {
  press(cellOf(1))
  await sleep(10)
  assert.equal(buysSent().length, 0)
  hold(cellOf(1))                            // 🍚 за 5
  await sleep(30)
  assert.equal(buysSent().length, 1)
  const b = buysSent()[0]
  assert.equal(b.t, 'buy')
  assert.equal(b.e, '🍚')
  assert.equal(b.c, 5)
  assert.equal(typeof b.ts, 'number')
  assert.equal(typeof b.id, 'string')
  assert.equal(phone.b, 45)
  assert.equal(texts().includes('45'), true)
})

await t('товары без цены (💬 🧁) не продаются: событий нет, баланс не меняется', async () => {
  hold(cellOf(6))                            // 💬: цены нет
  hold(cellOf(3))                            // 🧁: цены нет
  await sleep(20)
  assert.equal(buysSent().length, 1)
  assert.equal(phone.b, 45)
})

await t('👁️ (цена 0) — теперь обычная покупка: событие buy сразу, таймера нет (эмодзи на месте, цифр и закрашенной строки нет)', async () => {
  hold(cellOf(5))
  await sleep(30)
  assert.equal(buysSent().length, 2)
  assert.equal(buysSent()[1].e, '👁️')
  assert.equal(buysSent()[1].e.length, 3)    // с селектором U+FE0F
  assert.equal(buysSent()[1].c, 0)
  assert.equal(phone.b, 45)
  assert.equal(imgs().includes('sh5.png'), true)             // эмодзи 👁️ на месте
  assert.equal(shTxt(), undefined)
  assert.equal(band(), undefined)
})

await t('🌴: первые 10 минут бесплатно (событий нет); строка закрашена зелёным на всю ширину, на месте эмодзи чёрный счёт минут вверх; нажатие на строку — пауза (серая), ещё раз — продолжение', async () => {
  assert.equal(cellOf(0).props.x, 138)                       // 🌴 по центру первой строки (середина 198)
  skew += 3000
  hold(cellOf(0))
  await sleep(30)
  assert.equal(buysSent().length, 2)                         // запуск ничего не списал
  assert.equal(phone.b, 45)
  assert.equal(imgs().includes('sh0.png'), false)            // эмодзи заменено цифрами
  assert.equal(shTxt().props.text, '0')
  assert.equal(shTxt().props.color, 0x000000)
  assert.equal(band().props.normal_color, 0x3bf76d)          // зелёный
  assert.equal(band().props.w, 432)                          // строка закрашена целиком
  assert.equal(buttons().some((w) => w.props.w === 396), false)   // на весь экран ничего нет
  hold(cellOf(0))                                            // то же долгое нажатие сразу после запуска таймер не останавливает
  await sleep(20)
  assert.equal(shTxt().props.text, '0')
  skew += 60000
  page.tick()
  assert.equal(shTxt().props.text, '1')                      // минуты вверх
  press(band())                                              // пауза
  await sleep(10)
  assert.equal(band().props.normal_color, 0x8c8c8c)
  assert.equal(shTxt().props.text, '1')
  assert.equal(shTxt().props.color, 0x000000)                // цифры того же цвета
  skew += 10 * 60000                                         // на паузе время не идёт
  page.tick()
  assert.equal(shTxt().props.text, '1')
  press(band())                                              // продолжение
  await sleep(10)
  assert.equal(band().props.normal_color, 0x3bf76d)
})

await t('🌴: на 10-й минуте списывается 1, на 20-й 2 (события buy с ценой блока); после 20 минут строка жёлтая, после 40 — красная; цифры по-прежнему чёрные', async () => {
  skew += 9 * 60000
  page.tick()
  await sleep(40)
  assert.equal(shTxt().props.text, '10')
  assert.equal(buysSent().length, 3)
  assert.equal(buysSent()[2].e, '🌴')
  assert.equal(buysSent()[2].c, 1)
  assert.equal(phone.b, 44)
  assert.equal(band().props.normal_color, 0x3bf76d)          // 10 минут — ещё зелёная
  skew += 10 * 60000
  page.tick()
  await sleep(40)
  assert.equal(buysSent()[3].c, 2)
  assert.equal(phone.b, 42)
  assert.equal(band().props.normal_color, 0xffd21f)          // 20 минут — жёлтая
  assert.equal(shTxt().props.color, 0x000000)
  skew += 20 * 60000                                         // 30-я минута — 2, 40-я — 3
  page.tick()
  await sleep(80)
  assert.deepEqual(buysSent().slice(4).map((b) => b.c), [2, 3])
  assert.equal(phone.b, 37)
  assert.equal(shTxt().props.text, '40')
  assert.equal(band().props.normal_color, 0xff4517)          // 40 минут — красная
  assert.equal(shTxt().props.color, 0x000000)
})

await t('🌴: долгое нажатие на строку — остановка (ничего не возвращается и не шлётся); снова эмодзи, цена следующего блока 3 (за последний час 40 минут)', async () => {
  hold(band())
  await sleep(30)
  assert.equal(shTxt(), undefined)
  assert.equal(band(), undefined)
  assert.equal(imgs().includes('sh0.png'), true)
  assert.equal(buysSent().length, 6)
  assert.equal(phone.b, 37)
  assert.equal(texts().includes('3'), true)                  // под 🌴 — 🌸 3 (цену от телефона 30 игнорируем)
  assert.equal(texts().includes('30'), false)
})

await t('не хватает баланса: при балансе 1 новый 🌴 (первый блок стоит 3) не запускается; через час запуск снова бесплатный, но на 20-й минуте цветов на блок нет — таймер сам останавливается', async () => {
  phone.b = 1
  page.syncPhone(true)
  await sleep(30)
  skew += 3000
  hold(cellOf(0))
  await sleep(30)
  assert.equal(shTxt(), undefined)                           // отказ: таймер не запущен
  assert.equal(buysSent().length, 6)
  assert.equal(phone.b, 1)
  skew += 61 * 60000                                         // час прошёл — снова бесплатно
  page.tick()
  await sleep(10)
  hold(cellOf(0))
  await sleep(30)
  assert.equal(shTxt().props.text, '0')
  skew += 10 * 60000
  page.tick()
  await sleep(40)
  assert.equal(buysSent().length, 7)                         // 10-я минута: 1 цветок из одного
  assert.equal(phone.b, 0)
  assert.equal(shTxt().props.text, '10')
  skew += 10 * 60000                                         // 20-я минута: нужно 2, а цветов нет
  page.tick()
  await sleep(40)
  assert.equal(shTxt(), undefined)                           // таймер остановился сам
  assert.equal(band(), undefined)
  assert.equal(buysSent().length, 7)
  assert.equal(imgs().includes('sh0.png'), true)
  phone.b = 27                                               // дальше проверки на балансе 27
  page.syncPhone(true)
  await sleep(30)
})

await t('старый LuvU613 (ответ без поля f): «нет связи», ничего не продаётся', async () => {
  phone.f = false
  const bg = buttons().find((w) => w.props.w === 432 && w.props.normal_color === 0 && w.props.text === '')
  hold(bg)
  await sleep(20)
  hold(balBtn())
  await sleep(40)
  assert.equal(texts().includes('нет связи'), true)
  const sent = buysSent().length
  hold(cellOf(1))
  await sleep(20)
  assert.equal(buysSent().length, sent)
})

await t('телефон недоступен при открытии: «нет связи», покупка отклоняется', async () => {
  const bg = buttons().find((w) => w.props.w === 432 && w.props.normal_color === 0 && w.props.text === '')
  hold(bg)
  await sleep(20)
  phone.f = true
  phone.online = false
  hold(balBtn())
  await sleep(40)
  assert.equal(texts().includes('нет связи'), true)
  const sent = buysSent().length
  hold(cellOf(1))
  await sleep(20)
  assert.equal(buysSent().length, sent)
  phone.online = true
})

await t('выход из магазина — долгое нажатие на строку баланса (то же место); на главном экране снова виден баланс', async () => {
  assert.equal(imgs().includes('sh0.png'), true)                 // после прошлого теста магазин открыт
  hold(balBtn())
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), false)
  assert.equal(imgs().includes('fl.png'), true)
  assert.equal(texts().includes('27'), true)                     // последний известный баланс телефона (связи при открытии не было — серый)
  hold(balBtn())                                                 // вход
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), true)
  const bg = buttons().find((w) => w.props.w === 432 && w.props.h > 400 && w.props.text === '' && w.props.normal_color === 0)
  hold(bg)                                                       // выход долгим нажатием на пустое место тоже работает
  await sleep(30)
  assert.equal(imgs().includes('sh0.png'), false)
})

await t('строка баланса: тот же размер и то же место, что в магазине; кнопки занятий ближе друг к другу, чем раньше (зазор 25 вместо 51)', async () => {
  const fl = alive().filter((w) => w.type === 'IMG' && w.props.src === 'fl.png')   // главный экран и магазин
  assert.equal(fl.length, 2)
  assert.equal(fl[0].props.w, fl[1].props.w)
  assert.equal(fl[0].props.h, fl[1].props.h)
  assert.equal(fl[0].props.w, 44)
  const nums = alive().filter((w) => w.type === 'TEXT' && w.props.text_size === 40)
  assert.equal(nums.length >= 2, true)                           // цифры баланса того же размера (40) там и там
  assert.equal(fl[0].props.y, fl[1].props.y)                     // стоят на одном месте экрана
  const y0 = byImg('i0.png').props.y
  assert.equal(fl[0].props.y - y0, 41 - 223)                     // баланс над первым рядом кнопок: 41 и 223 в координатах страницы
  assert.equal(byImg('i3.png').props.y - y0, 145)                // кнопка 120 + зазор 25
  assert.equal(byImg('i0.png').props.y, byImg('i2.png').props.y)
  assert.equal(byImg('i0.png').props.w, 120)                     // размер кнопок прежний
})

await sleep(2100)

await t('ввод очереди (долгое нажатие слева): кнопки вводят по одному эмодзи, долгое нажатие на кнопку сохраняет шесть в её ячейку, долгое справа сбрасывает введённое', async () => {
  hold(zoneBtn(0))
  await sleep(10)
  for (const k of [0, 1, 2, 3, 4, 5]) press(byImg('i' + k + '.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), [0, 1, 2, 3, 4, 5])               // введённое видно на экране
  hold(byImg('i0.png'))                                          // ячейка кнопки 🧬
  await sleep(10)
  hold(zoneBtn(2))                                               // сбросить введённое
  await sleep(10)
  assert.deepEqual(queueNow(), [])
  for (const k of [5, 4, 3, 2, 1]) press(byImg('i' + k + '.png'))
  press(zoneBtn(1))                                              // центр во время ввода — 🏠
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1, 6])
  hold(byImg('i1.png'))                                          // ячейка кнопки 💀
  await sleep(10)
  hold(zoneBtn(0))                                               // выход: введённая очередь становится текущей
  await sleep(10)
  assert.deepEqual(queueNow(), [5, 4, 3, 2, 1, 6])
})

await t('долгое нажатие на кнопку вызывает очередь её ячейки: пусто / другая — замена шестью; те же шесть — удвоение (12); третий раз — ничего; другая ячейка — замена', async () => {
  const A = [0, 1, 2, 3, 4, 5]
  const B = [5, 4, 3, 2, 1, 6]
  hold(byImg('i1.png'))                                          // в очереди ровно B (ячейка 💀) — удваивается
  await sleep(10)
  assert.deepEqual(queueNow(), B.concat(B))
  hold(byImg('i1.png'))                                          // третье нажатие: ничего
  await sleep(10)
  assert.deepEqual(queueNow(), B.concat(B))
  hold(byImg('i0.png'))                                          // другая ячейка заменяет
  await sleep(10)
  assert.deepEqual(queueNow(), A)
  hold(byImg('i0.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i0.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i2.png'))                                          // пустая ячейка — очередь не меняется
  await sleep(10)
  assert.deepEqual(queueNow(), A.concat(A))
  hold(byImg('i1.png'))
  await sleep(10)
  assert.deepEqual(queueNow(), B)
})

await t('отпускание пальца после долгого нажатия на кнопку не запускает её таймер', async () => {
  hold(byImg('i0.png'))
  press(byImg('i0.png'))                                         // «отпускание» сразу после долгого нажатия на той же кнопке
  await sleep(10)
  assert.equal(runBtn(), undefined)
})

await t('автостарт — обычное нажатие на строку баланса; идёт розовый экран: нажатие — пауза 🩸 и возврат, долгое нажатие — остановка и выключение автостарта', async () => {
  await sleep(2100)
  hold(byImg('i1.png'))                                          // очередь = B, снова по ячейке 💀
  await sleep(10)
  const q = queueNow()
  assert.equal(q.length >= 6, true)
  press(balBtn())
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)                     // занятие из начала очереди пошло
  assert.equal(runBtn().props.text.length, 5)                    // цифры мм:сс
  assert.deepEqual(queueNow().length > 0, true)                  // над цифрами остаток очереди
  assert.equal(imgs().includes('o' + q[0] + '.png'), true)       // под цифрами эмодзи идущего занятия
  const before = queueNow()
  press(runBtn())                                                // нажатие: временная пауза 🩸, очередь та же
  await sleep(30)
  assert.equal(imgs().includes('o2.png'), true)
  assert.deepEqual(queueNow(), before)
  press(runBtn())                                                // повторное нажатие: возврат
  await sleep(30)
  assert.equal(imgs().includes('o' + q[0] + '.png'), true)
  hold(runBtn())                                                 // стоп занятия — долгое нажатие
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('очередь, правая зона: обычное нажатие — журнал теста (14 строк), долгое на журнале закрывает; долгое на зоне — удалить очередь', async () => {
  press(zoneBtn(2))
  await sleep(10)
  assert.equal(buttons().filter((w) => w.props.text_size === 18).length >= 14, true)
  assert.equal(zoneBtn(0), undefined)                            // главный экран спрятан
  hold(buttons().find((w) => w.props.text_size === 18))
  await sleep(10)
  assert.equal(zoneBtn(0) !== undefined, true)
  assert.equal(queueNow().length > 0, true)
  hold(zoneBtn(2))                                               // долгое справа — удалить очередь (после остановки занятия автостарт выключен, иначе очередь не удалилась бы)
  await sleep(10)
  assert.deepEqual(queueNow(), [])
})

await t('очередь, центр: обычное нажатие — серый таймер (выход долгим нажатием), долгое — экран настройки ценности 🩸', async () => {
  press(zoneBtn(1))
  await sleep(30)
  const gray = buttons().find((w) => w.props.normal_color === 0x8c8c8c)
  assert.equal(gray !== undefined, true)
  assert.equal(zoneBtn(1), undefined)
  hold(gray)
  await sleep(30)
  assert.equal(buttons().some((w) => w.props.normal_color === 0x8c8c8c), false)
  await sleep(900)
  hold(zoneBtn(1))
  await sleep(30)
  assert.equal(texts().includes('60 мин'), true)                 // экран настройки ценности
  const bg = buttons().find((w) => w.props.w === 432 && w.props.h > 400 && w.props.text === '' && w.props.normal_color === 0)
  hold(bg)                                                       // закрыть долгим нажатием
  await sleep(30)
  assert.equal(texts().includes('60 мин'), false)
  assert.equal(zoneBtn(1) !== undefined, true)
})

await t('очередь, левая зона: обычное нажатие — тестовый режим вкл / выкл (на кнопках секунды вместо минут)', async () => {
  await sleep(900)
  press(zoneBtn(0))                                              // тест включён
  await sleep(10)
  press(byImg('i2.png'))
  await sleep(30)
  const sec = runBtn()
  assert.equal(sec !== undefined && (sec.props.text === '00:20' || sec.props.text === '00:19'), true)   // цифры мм:сс
  hold(sec)                                                      // стоп — долгое нажатие
  await sleep(30)
  assert.equal(runBtn(), undefined)
  press(zoneBtn(0))                                              // тест выключен
  await sleep(900)                                               // после долгого нажатия (стоп) нажатие на кнопку считается отпусканием пальца
  press(byImg('i2.png'))
  await sleep(30)
  const min = runBtn()
  assert.equal(min !== undefined && (min.props.text === '60:00' || min.props.text === '59:59'), true)
  hold(min)
  await sleep(30)
  assert.equal(runBtn(), undefined)
})

await t('идёт 🩸 (обычный запуск): нажатие на розовый экран ничего не делает; цифры мм:сс, внизу 🩸, вверху 🔄🩸; моно 🏠 серым: нажатие — пауза 🩸 и возврат', async () => {
  await sleep(900)
  press(byImg('i2.png'))                                         // занятие 🩸 идёт
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  assert.equal(zoneBtn(0), undefined)                            // главный экран закрыт розовым
  assert.deepEqual(queueNow(), [9, 2])                           // 🔄🩸 над цифрами
  assert.equal(imgs().includes('o2.png'), true)                  // 🩸 под цифрами
  press(runBtn())                                                // 🩸 уже идёт — ничего не происходит
  await sleep(30)
  assert.equal(runBtn() !== undefined, true)
  hold(runBtn())
  await sleep(30)
  assert.equal(runBtn(), undefined)
  await sleep(900)
  press(zoneBtn(1))                                              // серый таймер (моно 🏠)
  await sleep(30)
  const gray = () => buttons().find((w) => w.props.normal_color === 0x8c8c8c && w.props.w === 396)
  assert.deepEqual(queueNow(), [9, 6])                           // 🔄🏠
  press(gray())                                                  // пауза 🩸: серый сменился розовым
  await sleep(30)
  assert.equal(gray(), undefined)
  assert.equal(runBtn() !== undefined, true)
  assert.deepEqual(queueNow(), [9, 2])
  press(runBtn())                                                // возврат к 🏠
  await sleep(30)
  assert.equal(gray() !== undefined, true)
  hold(gray())
  await sleep(30)
  assert.equal(gray(), undefined)
})

page.onDestroy()
console.log('\nВсе проверки страницы пройдены: ' + n)
process.exit(0)
