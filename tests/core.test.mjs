import assert from 'node:assert'
import * as core from '../shared/core.js'

const T = 1000000   // run=0 означает «не идёт», поэтому время в тестах начинаем не с нуля
const M = 60000
let n = 0
function t(name, f) { f(); n++; console.log('ok  ' + name) }

t('шесть занятий, ценность по умолчанию 60', () => {
  assert.equal(core.COUNT, 6)
  assert.equal(core.newState(false).val, 60)
})

t('ценность по области экрана настройки: сетка 3×3 как 7 8 9 / 4 5 6 / 1 2 3, номер × 10 минут', () => {
  // строка 0 — верхняя, 2 — нижняя; столбец 0 — левый, 2 — правый
  assert.equal(core.areaVal(2, 0), 10)   // левый нижний угол
  assert.equal(core.areaVal(2, 1), 20)
  assert.equal(core.areaVal(2, 2), 30)   // правый нижний угол
  assert.equal(core.areaVal(1, 0), 40)
  assert.equal(core.areaVal(1, 1), 50)   // центр
  assert.equal(core.areaVal(1, 2), 60)
  assert.equal(core.areaVal(0, 0), 70)   // левый верхний угол
  assert.equal(core.areaVal(0, 1), 80)
  assert.equal(core.areaVal(0, 2), 90)   // правый верхний угол
  const all = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) all.push(core.areaVal(r, c))
  assert.deepEqual(all.slice().sort((x, y) => x - y), core.VALUES)   // девять областей — девять разных значений
})

t('ценность 90 минут: кнопка показывает минуты вверх до 90, событие и промежуток — 90 минут', () => {
  const st = core.newState(false, core.areaVal(0, 2))
  assert.equal(st.val, 90)
  core.toggle(st, 0, T)
  assert.equal(core.label(st, 90 * M), '90')
  assert.equal(core.label(st, 89 * M + 1), '90')
  assert.equal(core.label(st, 1), '1')
  const r = core.process(st, T + 90 * M)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 90 * M)
  assert.equal(r.events[0].ts, T + 90 * M)
  assert.equal(core.fullMs(st), 90 * M)
  const s10 = core.newState(false, core.areaVal(2, 0))
  core.toggle(s10, 0, T)
  assert.equal(core.process(s10, T + 30 * M).events.length, 3)   // при 10 минутах за 30 минут — три границы
})

t('промежуток = ценность: событие через 30 минут, вибрация, отсчёт идёт дальше', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 0, T)
  assert.equal(core.label(st, core.remaining(st, 0, T)), '30')
  assert.equal(core.process(st, T + 29 * M).events.length, 0)
  const r = core.process(st, T + 30 * M)
  assert.equal(r.events.length, 1)
  assert.equal(r.fresh, true)
  const ev = r.events[0]
  assert.equal(ev.k, 'b'); assert.equal(ev.f, 1); assert.equal(ev.ms, 30 * M)
  assert.equal(ev.id, 'b0-' + (T + 30 * M))
  assert.equal(core.running(st, 0), true)
  assert.equal(core.remaining(st, 0, T + 30 * M), 30 * M)   // сразу пошёл следующий промежуток
})

t('экран был выключен: пропущенные промежутки засчитываются с настоящим временем', () => {
  const st = core.newState(false, 45)
  core.toggle(st, 2, T)
  const r = core.process(st, T + 100 * M)           // прошло 2 промежутка и ещё 10 минут
  assert.equal(r.events.length, 2)
  assert.equal(r.events[1].ts, T + 90 * M)
  assert.equal(r.fresh, false)                      // давно — не вибрируем
  assert.equal(core.remaining(st, 2, T + 100 * M), 35 * M)
})

t('стоп: таймер обнуляется, на телефон уходит пройденное время', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 1, T)
  core.toggle(st, 1, T + 20 * M)                    // нажали ещё раз — стоп
  assert.equal(core.running(st, 1), false)
  assert.equal(st.out.length, 1)
  assert.equal(st.out[0].ms, 20 * M)
  assert.equal(st.out[0].f, 0)
  assert.equal(core.label(st, core.remaining(st, 1, T + 21 * M)), '60')   // снова равен ценности
})

t('стоп раньше секунды ничего не отправляет', () => {
  const st = core.newState(false)
  core.toggle(st, 1, T)
  core.toggle(st, 1, T + 500)
  assert.equal(st.out.length, 0)
})

t('запуск другого занятия останавливает прежнее и отправляет пройденное', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 0, T)
  core.toggle(st, 4, T + 12 * M)
  assert.equal(core.running(st, 0), false)
  assert.equal(core.running(st, 4), true)
  assert.equal(st.out.length, 1)
  assert.equal(st.out[0].i, 0)
  assert.equal(st.out[0].ms, 12 * M)
})

t('стоп сначала учитывает завершившийся промежуток', () => {
  const st = core.newState(false, 30)
  core.toggle(st, 3, T)
  core.toggle(st, 3, T + 40 * M)                    // 30 минут уже прошло, 10 — следующего
  assert.equal(st.out.length, 2)
  assert.equal(st.out[0].f, 1)
  assert.equal(st.out[1].ms, 10 * M)
})

t('тест: промежуток 20 секунд, но телефону уходит полная ценность', () => {
  const st = core.newState(true, 45)
  core.toggle(st, 2, T)
  assert.equal(core.label(st, core.remaining(st, 2, T)), '20')
  assert.equal(core.label(st, core.remaining(st, 2, T + 4200)), '16')
  const r = core.process(st, T + 20000)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 45 * M)
  assert.equal(r.events[0].x, 1)
  // стоп на половине теста — половина ценности
  core.toggle(st, 2, T + 30000)
  assert.equal(st.out[st.out.length - 1].ms, Math.round(22.5 * M))
})

const shopSt0 = (b, p) => { const st = core.newState(false, 60); core.setShopFrom(st, { b: b, p: p || {} }); return st }

t('серый на весь экран = ценность; таймер магазина 🌴 — не на весь экран, срока нет, считает вверх', () => {
  const st = core.newState(false, 30)
  core.startOverlay(st, 'y', T)
  assert.equal(core.clock(core.ovLeft(st, T)), '30:00')
  assert.equal(core.clock(core.ovLeft(st, T + 5000)), '29:55')
  const s2 = shopSt0(100)
  assert.equal(core.shopBuy(s2, 0, T, true).ok, true)
  assert.equal(s2.sh.k, 'g')
  assert.equal(core.shopLabel(s2, T), '0')                        // минуты вверх, без секунд
  assert.equal(core.shopLabel(s2, T + M - 1), '0')
  assert.equal(core.shopLabel(s2, T + M), '1')
  assert.equal(core.shopLabel(s2, T + 12 * M + 30000), '12')
  assert.equal(core.overlayKind(s2), '')                         // на весь экран — ничего
  assert.equal(core.anyRunning(s2), false)
  assert.equal(core.nextDue(s2).length, 0)                       // конца нет — будильник не нужен
  assert.equal(core.shopLabel(core.newState(false, 60), T), '')  // таймера нет — подписи нет
})

t('тест: серый 20 секунд; у таймера 🌴 блок 4 секунды, час — 24 секунды, цифры — секунды', () => {
  const g = core.newState(true, 60)
  core.startOverlay(g, 'y', T)
  assert.equal(core.clock(core.ovLeft(g, T)), '00:20')
  const s = shopSt0(100)
  s.test = true
  core.shopBuy(s, 0, T, true)
  assert.equal(core.shBlock(s), 4000)
  assert.equal(core.shopLabel(s, T + 7000), '7')                  // секунды
  core.process(s, T + 20000)                                      // блоки начались на 4, 8, 12, 16, 20 секунде: 1 + 2 + 2 + 3 + 3
  assert.equal(s.out.reduce((a, e) => a + e.c, 0), 11)
  assert.equal(core.process(s, T + 100000).ovDone, false)         // и конца нет
})

t('серый (моно): по окончании шлёт ценность 🩸 для 🏠 и очередь не трогает; внутри автостарта закрывает свой пункт очереди', () => {
  const st = core.newState(false, 30)
  st.queue = ['🩸', '🔍', '🏠']
  core.startOverlay(st, 'y', T)
  assert.equal(core.process(st, T + 29 * M).events.length, 0)
  const r = core.process(st, T + 30 * M)
  assert.equal(r.ovDone, false)                            // серый идёт по кругу: не закрывается
  assert.equal(core.overlayActive(st), true)
  assert.equal(st.out.length, 1)
  assert.equal(st.out[0].k, 'b')
  assert.equal(st.out[0].ms, 30 * M)
  assert.equal(st.out[0].f, 1)
  assert.equal(core.EMOJI[st.out[0].i], '🏠')               // вручную запущенный серый — всегда 🏠
  assert.deepEqual(st.queue, ['🩸', '🔍', '🏠'])            // очередь не тронута
  core.process(st, T + 60 * M)                             // второй круг
  assert.equal(st.out.length, 2)
  assert.equal(st.mono.n, 2)
  // автостарт: 🔍 стоит первым — серый идёт как 🔍 и закрывает именно его
  const sa = core.newState(false, 30)
  sa.queue = ['🔍', '🏠']
  core.startAuto(sa, T)
  core.process(sa, T + 30 * M)
  assert.equal(core.EMOJI[sa.out[0].i], '🔍')
  assert.deepEqual(sa.queue, ['🏠'])
  // endOverlay закрывает таймер молча (досрочный выход долгим нажатием — exitOverlay, он время отправляет)
  const st2 = core.newState(false, 30)
  core.startOverlay(st2, 'y', T)
  core.endOverlay(st2)
  core.process(st2, T + 60 * M)
  assert.equal(st2.out.length, 0)
})

t('серый, закрытый досрочно: пройденное время уходит тому же занятию, очередь не меняется', () => {
  const st = core.newState(false, 30)
  st.queue = ['🩸', '🔍', '🏠']
  core.startOverlay(st, 'y', T)
  const r = core.exitOverlay(st, T + 10 * M)
  assert.equal(r.ev.k, 'b')
  assert.equal(core.EMOJI[r.ev.i], '🏠')
  assert.equal(r.ev.ms, 10 * M)                // ценность 30 минут, серый шёл 30 минут -> прошло 10
  assert.equal(r.ev.f, 0)
  assert.equal(st.out.length, 1)
  assert.deepEqual(st.queue, ['🩸', '🔍', '🏠'])
  assert.equal(core.overlayActive(st), false)
  // очередь пуста — время идёт 🏠
  const s2 = core.newState(false, 45)
  core.startOverlay(s2, 'y', T)
  const r2 = core.exitOverlay(s2, T + 20 * M)
  assert.equal(core.EMOJI[r2.ev.i], '🏠')
  assert.equal(r2.ev.ms, 20 * M)
  // короче секунды — ничего
  const s3 = core.newState(false, 30)
  core.startOverlay(s3, 'y', T)
  assert.equal(core.exitOverlay(s3, T + 500).ev, null)
  assert.equal(s3.out.length, 0)
  // тестовый режим (20 секунд вместо ценности): 10 секунд из 20 = половина ценности
  const s4 = core.newState(true, 30)
  core.startOverlay(s4, 'y', T)
  const r4 = core.exitOverlay(s4, T + 10000)
  assert.equal(r4.ev.ms, 15 * M)
  // круг закончился, но приложение не успело обработать: сначала полный круг, потом минута следующего (серый идёт по кругу)
  const s5 = core.newState(false, 30)
  core.startOverlay(s5, 'y', T)
  core.exitOverlay(s5, T + 31 * M)
  assert.equal(s5.out.length, 2)
  assert.equal(s5.out[0].f, 1)
  assert.equal(s5.out[1].f, 0)
  assert.equal(s5.out[1].ms, M)
})

t('запуск серого таймера останавливает идущее занятие', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 5, T)
  core.startOverlay(st, 'y', T + 7 * M)
  assert.equal(core.running(st, 5), false)
  assert.equal(st.out[0].ms, 7 * M)
  assert.equal(core.anyRunning(st), true)
})

t('подтверждение и повторная отправка', () => {
  const st = core.newState(false, 60)
  core.toggle(st, 0, T)
  core.process(st, T + 60 * M)
  assert.equal(core.due(st, T + 60 * M, 15000).length, 1)
  st.out[0].tried = T + 60 * M
  assert.equal(core.due(st, T + 60 * M + 1000, 15000).length, 0)
  assert.equal(core.due(st, T + 60 * M + 16000, 15000).length, 1)
  assert.equal(core.ack(st, st.out[0].id), true)
  assert.equal(st.out.length, 0)
})

t('сохранение и восстановление (в том числе старое сохранение v3)', () => {
  const st = core.newState(false, 45)
  core.toggle(st, 1, T + 100)
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.val, 45)
  assert.equal(back.run[1], T + 100)
  const old = core.restore(JSON.stringify({ v: 3, rem: [1, 2, 3, 4, 5, 6, 7, 8, 9], run: [0, 0, T, 0, 0, 0, 0, 0, 0], hold: -1, q: { s: 1, run: T }, out: [{ id: '0-5', i: 0, ts: 5 }] }), false, 60)
  assert.equal(old.run[2], T)
  assert.equal(old.q.s, 0)                         // красный / жёлтый / зелёный на весь экран из старых версий отбрасываются (покупка уже списана)
  assert.equal(old.out.length, 1)
  const done = core.restore(JSON.stringify({ v: 4, run: [0, 0, 0, 0, 0, 0], q: { k: 'y', s: 2, run: T } }), false, 60)
  assert.equal(core.overlayActive(done), false)    // закончившийся таймер из прошлой версии не возвращается
  assert.equal(core.restore('мусор', false, 30).val, 30)
  assert.equal(core.restore('', true, 60).test, true)
})

t('очередь фиксированная: занятие, запущенное нажатием (моно), очередь не трогает — даже если стоит в ней первым', () => {
  const st = core.newState(false, 30)
  st.queue = ['🩸', '🧬', '🩸']
  core.toggle(st, 2, T)                                   // 🩸 вручную
  core.process(st, T + 90 * M)                            // три полных промежутка
  assert.deepEqual(st.queue, ['🩸', '🧬', '🩸'])
  assert.equal(st.out.filter(e => e.k === 'b').length, 3) // минуты 🩸 телефону уходят как раньше
  assert.equal(st.qs, null)                               // запись очереди не начиналась
})

t('моно-занятие: запись для журнала — число полных промежутков × ценность; меньше 60 минут не уходит; неполный промежуток не считается', () => {
  const mo = (s) => s.out.filter(e => e.k === 'mo')
  const st = core.newState(false, 30)
  core.toggle(st, 3, T)                                   // 🤖
  core.process(st, T + 100 * M)                           // три полных по 30
  core.toggle(st, 3, T + 100 * M)                         // стоп
  assert.equal(mo(st).length, 1)
  assert.equal(mo(st)[0].n, 3); assert.equal(mo(st)[0].v, 30); assert.equal(mo(st)[0].ts, T); assert.equal(core.EMOJI[mo(st)[0].i], '🤖')
  const s2 = core.newState(false, 20)                     // полтора круга при ценности 20 — один круг, 20 < 60
  core.toggle(s2, 0, T)
  core.toggle(s2, 0, T + 30 * M)
  assert.equal(mo(s2).length, 0)
  const s3 = core.newState(false, 10)                     // ценность 10: шесть кругов = 60 — уходит; запуск другого занятия тоже закрывает моно
  core.toggle(s3, 1, T)
  core.process(s3, T + 65 * M)
  core.toggle(s3, 4, T + 65 * M)
  assert.equal(mo(s3).length, 1); assert.equal(mo(s3)[0].n, 6)
  const back = core.newState(false, 30)                   // идущее моно переживает перезапуск приложения
  core.toggle(back, 2, T)
  const again = core.restore(JSON.stringify(back), false, 30)
  assert.equal(again.mono.n, 0); assert.equal(again.mono.i, 2)
})

t('очередь хранится вместе с состоянием, чистится от лишнего и не длиннее 12', () => {
  const st = core.newState(false, 60)
  st.queue = ['🩸', '🏠', '🔍']
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.deepEqual(back.queue, ['🩸', '🏠', '🔍'])
  assert.deepEqual(core.cleanQueue(['🩸', '🍀', 'x', 5, '💀']), ['🩸', '💀'])   // 🍀 и мусор не попадают
  assert.equal(core.cleanQueue(new Array(30).fill('🩸')).length, 12)
  assert.deepEqual(core.cleanQueue(undefined), [])
  // события «новая очередь» из версии 15 и «подарок» (до 1.14.0) при загрузке выбрасываются, остальные остаются
  const old = core.newState(false, 60)
  old.out = [{ id: 'qs-1', k: 'qs', ts: T, q: ['🩸'], tried: 0 }, { id: 'g-1', k: 'g', ts: T, tried: 0 }, { id: 'b0-1', k: 'b', i: 0, ts: T, ms: M, f: 1, x: 0, tried: 0 }]
  const r = core.restore(JSON.stringify(old), false, 60)
  assert.deepEqual(r.out.map((e) => e.id), ['b0-1'])
})

t('случайная очередь: 6 занятий из восьми, не бывает двух одинаковых подряд, у всех равные шансы', () => {
  assert.deepEqual(core.RANDOM_POOL.slice().sort(), ['🏠', '🔍', '🧬', '💀', '🩸', '🤖', '🧭', '📖'].sort())
  const count = {}
  const firstCount = {}
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const N = 40000
  for (let k = 0; k < N; k++) {
    const q = core.randomQueue(rnd)
    assert.equal(q.length, 6)
    for (let i = 0; i < 6; i++) {
      assert.ok(core.RANDOM_POOL.includes(q[i]))
      if (i > 0) assert.notEqual(q[i], q[i - 1])
      count[q[i]] = (count[q[i]] || 0) + 1
    }
    firstCount[q[0]] = (firstCount[q[0]] || 0) + 1
  }
  // равные шансы: каждое эмодзи встречается примерно в 1/8 мест (допуск 4%), и повторы не подряд случаются
  for (const e of core.RANDOM_POOL) {
    assert.ok(Math.abs(count[e] / (N * 6) - 1 / 8) < 0.005, e + ' ' + count[e])
    assert.ok(Math.abs(firstCount[e] / N - 1 / 8) < 0.01, 'первое ' + e)
  }
  // самый «упрямый» источник случайных чисел (всегда 0 и всегда почти 1) тоже даёт верную очередь
  for (const f of [() => 0, () => 0.9999999]) {
    const q = core.randomQueue(f)
    assert.equal(q.length, 6)
    for (let i = 1; i < 6; i++) assert.notEqual(q[i], q[i - 1])
  }
  assert.equal(core.randomQueue().length, 6)              // без аргумента — настоящий Math.random
})

t('ценность 15 минут: промежуток и минуты для телефона', () => {
  const st = core.newState(false, 15)
  assert.equal(st.val, 15)
  assert.equal(core.valueMs(st), 15 * M)
  core.toggle(st, 0, T)
  const r = core.process(st, T + 15 * M)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 15 * M)
  assert.equal(core.label(st, 15 * M), '15')
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.val, 15)
})

t('эмодзи занятий: 🧬 💀 🩸 / 🤖 🧭 📖, затем 🏠 🍀 🔍', () => {
  assert.deepEqual(core.EMOJI.slice(0, 6), ['🧬', '💀', '🩸', '🤖', '🧭', '📖'])
  assert.deepEqual(core.EMOJI.slice(6), ['🏠', '🍀', '🔍'])
  assert.equal(core.SLOT_LEN, 6)
  // очередь из прошлой версии (другие эмодзи) при загрузке сбрасывается, таймеры и ценность остаются
  const oldSave = JSON.stringify({ v: 5, val: 45, run: [T, 0, 0, 0, 0, 0], q: { k: '', s: 0, run: 0 }, out: [], queue: ['🧬', '📖'] })
  const back = core.restore(oldSave, false, 60)
  assert.deepEqual(back.queue, [])
  assert.equal(back.val, 45)
  assert.equal(back.run[0], T)
})

t('автостарт: занятия идут по очереди, каждое один промежуток, в конце очереди автостарт выключается', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🩸', '🧭']
  core.startAuto(st, T)
  assert.equal(st.auto, true)
  assert.equal(st.run[0], T)
  assert.equal(core.process(st, T + 29 * M).events.length, 0)
  const r1 = core.process(st, T + 30 * M)
  assert.equal(r1.events.length, 1)
  assert.equal(r1.events[0].i, 0)
  assert.equal(r1.events[0].ms, 30 * M)                     // телефону — полная ценность 🩸
  assert.equal(r1.fresh, true)
  assert.deepEqual(st.queue, ['🩸', '🧭'])
  assert.equal(st.run[0], 0)
  assert.equal(st.run[2], T + 30 * M)                        // следующее началось ровно в момент окончания прежнего
  assert.equal(st.auto, true)
  core.process(st, T + 60 * M)
  assert.equal(st.run[4], T + 60 * M)
  assert.deepEqual(st.queue, ['🧭'])
  const r3 = core.process(st, T + 90 * M)
  assert.equal(r3.events[0].i, 4)
  assert.deepEqual(st.queue, [])
  assert.equal(st.auto, false)
  assert.equal(core.anyRunning(st), false)                   // очередь кончилась — ничего не идёт, по кругу не крутится
  assert.equal(st.out.filter(e => e.k === 'b').length, 3)   // три события занятий (плюс запись очереди «qr», она отдельная)
})

t('автостарт: экран был выключен — пропущенные занятия засчитываются с настоящим временем, лишнего не запускается', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🩸', '🧭']
  core.startAuto(st, T)
  const r = core.process(st, T + 100 * M)
  assert.deepEqual(r.events.map((e) => e.i), [0, 2, 4])
  assert.deepEqual(r.events.map((e) => e.ts), [T + 30 * M, T + 60 * M, T + 90 * M])
  assert.equal(r.fresh, false)                               // сигнал подаётся только для свежих событий
  assert.equal(st.auto, false)
  assert.equal(core.anyRunning(st), false)
  // середина очереди: два занятия засчитаны, третье идёт
  const s2 = core.newState(false, 30)
  s2.queue = ['🧬', '🩸', '🧭']
  core.startAuto(s2, T)
  core.process(s2, T + 70 * M)
  assert.equal(s2.auto, true)
  assert.equal(s2.run[4], T + 60 * M)
  assert.deepEqual(s2.queue, ['🧭'])
})

t('автостарт: одно и то же занятие подряд, 🏠 / 🔍 идут серым таймером', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🧬', '🏠', '🔍', '💀']
  core.startAuto(st, T)
  core.process(st, T + 30 * M)
  assert.equal(st.run[0], T + 30 * M)                        // второй 🧬 подряд
  const g = core.process(st, T + 60 * M)
  assert.equal(st.q.k, 'y')                                  // 🏠 — серый таймер
  assert.equal(st.q.run, T + 60 * M)
  assert.equal(core.overlayActive(st), true)
  assert.equal(g.ovDone, false)
  const r = core.process(st, T + 90 * M)
  assert.equal(r.ovDone, true)
  assert.equal(core.EMOJI[r.events[0].i], '🏠')              // время серого — 🏠 (он левее)
  assert.equal(r.events[0].ms, 30 * M)
  assert.deepEqual(st.queue, ['🔍', '💀'])
  assert.equal(st.q.k, 'y')                                  // следующий — 🔍, снова серый
  const r2 = core.process(st, T + 120 * M)
  assert.equal(core.EMOJI[r2.events[0].i], '🔍')
  assert.equal(st.run[1], T + 120 * M)                       // потом 💀
  core.process(st, T + 150 * M)
  assert.equal(st.auto, false)
  assert.deepEqual(st.queue, [])
})

t('🏠, введённый в очередь, ведёт себя как серый таймер: автостарт запускает его сам, по окончании убирает и шлёт 🏠 ценность 🩸', () => {
  const st = core.newState(false, 45)
  st.queue = core.cleanQueue(['🏠', '🧬', '🏠'])          // как после ввода: 🏠 — эмодзи с кнопки «центр верхней строки»
  assert.deepEqual(st.queue, ['🏠', '🧬', '🏠'])
  core.startAuto(st, T)
  assert.equal(st.auto, true)
  assert.equal(st.q.k, 'y')                                  // серый запущен сам, с первого же 🏠
  assert.equal(st.q.run, T)
  const r1 = core.process(st, T + 45 * M)
  assert.equal(r1.ovDone, true)
  assert.equal(r1.events.length, 1)
  assert.equal(core.EMOJI[r1.events[0].i], '🏠')
  assert.equal(r1.events[0].ms, 45 * M)
  assert.deepEqual(st.queue, ['🧬', '🏠'])                  // 🏠 убран из очереди
  assert.equal(st.q.s, 0)                                    // серый закрылся, пошёл 🧬
  assert.equal(st.run[0], T + 45 * M)
  core.process(st, T + 90 * M)
  assert.equal(st.q.k, 'y')                                  // и снова серый — на втором 🏠
  assert.equal(st.q.run, T + 90 * M)
  const r3 = core.process(st, T + 135 * M)
  assert.equal(core.EMOJI[r3.events[0].i], '🏠')
  assert.deepEqual(st.queue, [])
  assert.equal(st.auto, false)
  assert.equal(core.anyRunning(st), false)
  // экран выключен всё время: всё засчитывается с настоящим временем
  const s2 = core.newState(false, 45)
  s2.queue = ['🏠', '🧬', '🏠']
  core.startAuto(s2, T)
  const rr = core.process(s2, T + 500 * M)
  assert.deepEqual(rr.events.map((e) => core.EMOJI[e.i]), ['🏠', '🧬', '🏠'])
  assert.deepEqual(rr.events.map((e) => e.ts), [T + 45 * M, T + 90 * M, T + 135 * M])
  assert.deepEqual(s2.queue, [])
})

t('автостарт: стоп занятия (нажатие, другое занятие, цветной таймер, досрочный выход из серого) выключает автостарт', () => {
  const mk = () => { const s = core.newState(false, 30); s.queue = ['🧬', '🩸', '🧭']; core.startAuto(s, T); return s }
  const a = mk()
  core.toggle(a, 0, T + 10 * M)                              // стоп идущего
  assert.equal(a.auto, false)
  assert.equal(core.anyRunning(a), false)
  assert.deepEqual(a.queue, ['🧬', '🩸', '🧭'])              // очередь не тронута
  assert.equal(a.out.length, 1)                              // пройденное время ушло
  assert.equal(a.out[0].ms, 10 * M)
  const b = mk()
  core.toggle(b, 3, T + 10 * M)                              // другое занятие
  assert.equal(b.auto, false)
  assert.equal(b.run[3], T + 10 * M)
  assert.equal(b.run[0], 0)
  const c = mk()
  core.startOverlay(c, 'y', T + 10 * M)
  assert.equal(c.auto, false)
  const d = core.newState(false, 30)
  d.queue = ['🏠', '🧬']
  core.startAuto(d, T)
  const r = core.exitOverlay(d, T + 10 * M)                  // досрочный выход из серого
  assert.equal(d.auto, false)
  assert.equal(core.anyRunning(d), false)
  assert.equal(r.ev.ms, 10 * M)
  assert.deepEqual(d.queue, ['🏠', '🧬'])
  // выход из серого, который как раз закончился, а автостарт пошёл дальше: ничего лишнего не останавливается
  const e = core.newState(false, 30)
  e.queue = ['🏠', '🧬']
  core.startAuto(e, T)
  const r2 = core.exitOverlay(e, T + 31 * M)
  assert.equal(r2.ev, null)
  assert.equal(e.auto, true)
  assert.equal(e.run[0], T + 30 * M)
})

t('автостарт: включается только когда ничего не идёт и очередь не пуста', () => {
  const a = core.newState(false, 30)
  core.startAuto(a, T)
  assert.equal(a.auto, false)                                // очередь пуста
  const b = core.newState(false, 30)
  b.queue = ['🩸']
  core.toggle(b, 3, T)
  core.startAuto(b, T + M)
  assert.equal(b.auto, false)                                // уже что-то идёт
  assert.equal(b.run[2], 0)
  // «автостарт включён, но ничего не идёт» (битое сохранение) — выключается сам
  const c = core.newState(false, 30)
  c.auto = true
  core.process(c, T)
  assert.equal(c.auto, false)
})

t('автостарт: будильники — первая граница и сколько их ещё впереди', () => {
  const st = core.newState(false, 30)
  st.queue = ['🧬', '🩸', '🧭']
  core.startAuto(st, T)
  const d = core.nextDue(st)
  assert.equal(d.length, 1)
  assert.equal(d[0].t, T + 30 * M)
  assert.equal(d[0].kind, 'hour')
  assert.equal(d[0].n, 2)                                    // границ три: первая — этот будильник, ещё две — цепочкой службы
  core.process(st, T + 30 * M)
  assert.equal(core.nextDue(st)[0].n, 1)
  assert.equal(core.nextDue(st)[0].t, T + 60 * M)
  // обычные занятия — без n (цепочка без ограничения, как раньше)
  const o = core.newState(false, 30)
  core.toggle(o, 0, T)
  assert.equal(core.nextDue(o)[0].n, undefined)
})

t('тестовый режим: включается только когда ничего не идёт; всё по 20 секунд, телефону — полная ценность; переживает перезапуск', () => {
  const st = core.newState(false, 45)
  assert.equal(core.toggleTest(st), true)
  assert.equal(st.test, true)
  assert.equal(core.fullMs(st), 20000)
  core.toggle(st, 3, T)
  assert.equal(core.toggleTest(st), false)                   // идёт занятие — режим не меняется
  assert.equal(st.test, true)
  const r = core.process(st, T + 20000)
  assert.equal(r.events.length, 1)
  assert.equal(r.events[0].ms, 45 * M)                       // как будто прошла вся ценность 🩸
  assert.equal(r.events[0].x, 1)
  assert.equal(core.label(st, 20000), '20')                  // на кнопке секунды
  core.toggle(st, 3, T + 30000)
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.test, true)
  assert.equal(core.toggleTest(back), true)
  assert.equal(back.test, false)
  // серый таймер в тесте — тоже 20 секунд (идёт по кругу и не закрывается)
  const sg = core.newState(true, 30)
  core.startOverlay(sg, 'y', T)
  assert.equal(core.ovLen(sg), 20000)
  assert.equal(core.process(sg, T + 20000).ovDone, false)
  // автостарт в тесте: каждое занятие 20 секунд
  const a = core.newState(true, 60)
  a.queue = ['🧬', '🩸']
  core.startAuto(a, T)
  const ra = core.process(a, T + 40000)
  assert.deepEqual(ra.events.map((e) => e.ms), [60 * M, 60 * M])
  assert.equal(a.auto, false)
})

// ===================== МАГАЗИН (1.20.0: один таймер 🌴) =====================
const shopSt = (b, p) => { const st = core.newState(false, 60); core.setShopFrom(st, { b: b, p: p || {} }); return st }
const spentOf = (st) => st.out.filter((e) => e.k === 'p').reduce((a, e) => a + e.c, 0)

t('товары магазина: семь; 🌴 первым и единственный с таймером; 👁️ — обычная покупка (с селектором U+FE0F); 🌴 — по центру первой строки', () => {
  assert.deepEqual(core.SHOP.map((x) => x.e), ['🌴', '🍚', '🥤', '🧁', '🫦', '👁️', '💬'])
  assert.equal(core.SHOP[5].e, '\u{1F441}\uFE0F')
  assert.deepEqual(core.SHOP.map((x) => x.timer), ['g', '', '', '', '', '', ''])
  assert.deepEqual(core.SHOP_POS, [1, 3, 4, 5, 6, 7, 8])         // ячейки сетки 3×3: 🌴 — центр первой строки (1), остальные — две нижние строки
})

t('цена 🌴: первые 10 минут бесплатно; блок 10–20 — 1, 20–30 — 2, 30–40 — 2, 40–50 — 3, 50–60 — 3, выше не растёт; списывается в начале каждого блока', () => {
  const spentAt = (ms, bal) => {
    const st = shopSt(bal === undefined ? 1000 : bal)
    assert.equal(core.shopBuy(st, 0, T, true).ok, true)
    core.process(st, T + ms)
    return spentOf(st)
  }
  assert.equal(spentAt(10 * M - 1000), 0)        // 9 минут 59 секунд — ничего не списано
  assert.equal(spentAt(10 * M), 1)
  assert.equal(spentAt(20 * M), 3)               // 1 + 2
  assert.equal(spentAt(30 * M), 5)
  assert.equal(spentAt(40 * M), 8)
  assert.equal(spentAt(50 * M), 11)
  assert.equal(spentAt(55 * M), 11)              // 55 минут — 11 цветов (1 + 2 + 2 + 3 + 3)
  assert.equal(spentAt(60 * M), 14)              // дальше по 3 за каждые 10 минут
  assert.equal(spentAt(90 * M), 23)
  const st = shopSt(100)
  core.shopBuy(st, 0, T, true)
  assert.equal(st.out.length, 0)                 // первый блок бесплатный: событий нет
  core.process(st, T + 55 * M)
  assert.deepEqual(st.out.map((e) => [e.ts - T, e.c]), [[10 * M, 1], [20 * M, 2], [30 * M, 2], [40 * M, 3], [50 * M, 3]])
  assert.equal(new Set(st.out.map((e) => e.id)).size, 5)
  assert.ok(st.out.every((e) => e.k === 'p' && e.e === '🌴'))
  assert.equal(core.shopBalance(st), 89)         // 100 - 11
  assert.equal(core.process(st, T + 56 * M).shop, false)    // второй раз то же не списывается
  assert.equal(st.out.length, 5)
})

t('цена зависит от работы за последний час (скользящее окно): повторный запуск не бесплатен, пока час не прошёл; паузы не считаются', () => {
  const st = shopSt(100)
  core.shopBuy(st, 0, T, true)
  core.shopStop(st, T + 25 * M)                  // 25 минут: списано 1 + 2
  assert.equal(spentOf(st), 3)
  assert.equal(core.shopRate(st, T + 25 * M), 2)
  assert.equal(core.shopPrice(st, 0, T + 25 * M), 2)
  const r = core.shopBuy(st, 0, T + 35 * M, true)  // снова через 10 минут: за час уже 25 минут -> первый блок стоит 2
  assert.equal(r.ok, true)
  assert.equal(r.ev.c, 2)
  assert.equal(r.ev.ts, T + 35 * M)
  assert.equal(spentOf(st), 5)
  core.process(st, T + 45 * M)                   // через 10 минут за час уже 35 -> блок стоит 2
  assert.equal(st.out[st.out.length - 1].c, 2)
  assert.equal(st.out[st.out.length - 1].ts, T + 45 * M)
  core.shopStop(st, T + 46 * M)
  assert.equal(core.shopRate(st, T + 46 * M), 2) // 25 + 11 = 36 минут
  assert.equal(core.shopRate(st, T + 90 * M), 1) // окно [30; 90]: первый запуск вышел, остался второй (11 минут)
  assert.equal(core.shopRate(st, T + 120 * M), 0)  // час прошёл — снова бесплатно
  // пауза: время на паузе не считается ни в блоки, ни в окно
  const p = shopSt(100)
  core.shopBuy(p, 0, T, true)
  assert.equal(core.shopTap(p, T + 8 * M).paused, true)
  assert.equal(core.shopLabel(p, T + 30 * M), '8')           // стоит
  core.process(p, T + 90 * M)
  assert.equal(p.out.length, 0)                              // 8 минут — ничего не списано, хоть прошёл час
  assert.equal(core.shopUsed(p, T + 9 * M), 8 * M)
  assert.equal(core.shopTap(p, T + 30 * M).paused, false)    // продолжили
  assert.equal(core.shopLabel(p, T + 30 * M), '8')
  assert.equal(core.process(p, T + 32 * M - 1).shop, false)  // до десяти минут работы не хватает двух
  assert.equal(core.process(p, T + 32 * M).shop, true)
  assert.equal(p.out[0].ts, T + 32 * M)
  assert.equal(p.out[0].c, 1)                                // 8 + 2 = 10 минут за час
})

t('цвет строки таймера: зелёный до 20 минут, жёлтый до 40, красный дальше', () => {
  const st = shopSt(1000)
  core.shopBuy(st, 0, T, true)
  assert.equal(core.shopTone(st, T), 'g')
  assert.equal(core.shopTone(st, T + 20 * M - 1000), 'g')
  assert.equal(core.shopTone(st, T + 20 * M), 'p')
  assert.equal(core.shopTone(st, T + 40 * M - 1000), 'p')
  assert.equal(core.shopTone(st, T + 40 * M), 'r')
  assert.equal(core.shopTone(st, T + 100 * M), 'r')
  // цвет считается по времени этого запуска (его цифры на экране), с учётом паузы
  const p = shopSt(1000)
  core.shopBuy(p, 0, T, true)
  core.shopTap(p, T + 15 * M)
  assert.equal(core.shopTone(p, T + 50 * M), 'g')
})

t('не хватает 🌸 на следующий блок: таймер останавливается в момент его начала (ovDone, вибрация), недостающее не списывается', () => {
  const st = shopSt(4)
  core.shopBuy(st, 0, T, true)
  const r = core.process(st, T + 55 * M)         // 10:00 — 1, 20:00 — 2, 30:00 — нужно 2, а осталось 1
  assert.equal(r.ovDone, true)
  assert.equal(r.ovKind, 'g')
  assert.equal(r.ovFresh, false)                 // давно: страница открылась через 25 минут
  assert.equal(st.sh, null)
  assert.equal(spentOf(st), 3)
  assert.equal(core.shopBalance(st), 1)
  assert.deepEqual(st.su, [[T, T + 30 * M]])     // отработано ровно до начала блока, который не оплатить
  const s2 = shopSt(0)                           // баланс 0: первые 10 минут бесплатные, дальше — остановка сразу на границе
  core.shopBuy(s2, 0, T, true)
  const r2 = core.process(s2, T + 10 * M + 5000)
  assert.equal(r2.ovDone, true)
  assert.equal(r2.ovFresh, true)                 // 5 секунд назад — свежее, страница вибрирует
  assert.equal(s2.sh, null)
  assert.equal(s2.out.length, 0)
})

t('приложение было закрыто: блоки списываются на своих границах (ts), а не в момент открытия; остановка и конец без события', () => {
  const st = shopSt(100)
  core.shopBuy(st, 0, T, true)
  core.process(st, T + 33 * M)
  assert.deepEqual(st.out.map((e) => e.ts), [T + 10 * M, T + 20 * M, T + 30 * M])
  const s = core.shopStop(st, T + 34 * M)
  assert.equal(s.stopped, true)
  assert.equal(s.blocks, 4)                      // блоки 0, 10, 20, 30 минут начаты
  assert.equal(st.sh, null)
  assert.equal(st.out.length, 3)                 // остановка ничего не отправляет и не возвращает
  assert.equal(core.shopStop(st, T + 35 * M).stopped, false)
  assert.equal(core.shopBalance(st), 95)
})

t('запуск занятия / серого / автостарта останавливает таймер 🌴 (списанное остаётся, отработанное остаётся в окне часа)', () => {
  const starts = [
    (st, now) => core.toggle(st, 0, now),
    (st, now) => core.startOverlay(st, 'y', now),
    (st, now) => { st.queue = ['🧬']; core.startAuto(st, now) }
  ]
  for (const go of starts) {
    const a = shopSt(100)
    core.shopBuy(a, 0, T, true)
    go(a, T + 25 * M)
    assert.equal(a.sh, null)
    assert.equal(spentOf(a), 3)                  // 10:00 — 1, 20:00 — 2
    assert.deepEqual(a.su, [[T, T + 25 * M]])
    assert.equal(core.shopRate(a, T + 26 * M), 2)
    const b = shopSt(100)                        // и на паузе: таймер тоже останавливается
    core.shopBuy(b, 0, T, true)
    core.shopTap(b, T + 4 * M)
    go(b, T + 7 * M)
    assert.equal(b.sh, null)
    assert.equal(b.out.length, 0)
  }
})

t('обычный товар без цены купить нельзя; цена 0 — можно; баланс меньше цены — отказ; 🌴 с первым бесплатным блоком стартует и без цен от телефона', () => {
  const st = shopSt(10, { '🍿': 5, '🍚': 0 })
  for (const i of [2, 3, 4, 5, 6]) {
    assert.equal(core.shopPrice(st, i, T), null)
    const r = core.shopBuy(st, i, T, true)
    assert.equal(r.ok, false)
    assert.equal(r.why, 'noprice')
  }
  assert.equal(st.out.length, 0)
  assert.equal(core.shopBalance(st), 10)
  const free = core.shopBuy(st, 1, T, true)              // 🍚 за 0
  assert.equal(free.ok, true)
  assert.equal(free.ev.c, 0)
  const poor = shopSt(1, { '🍚': 2 })
  const r = core.shopBuy(poor, 1, T, true)
  assert.equal(r.ok, false)
  assert.equal(r.why, 'poor')
  assert.equal(poor.out.length, 0)
  assert.equal(core.shopPrice(st, 0, T), 0)               // 🌴: цена есть всегда (правило), сначала 0
  assert.equal(core.shopBuy(shopSt(0), 0, T, true).ok, true)    // нулевой баланс: первые 10 минут бесплатно
  const neg = shopSt(-1)
  assert.equal(core.shopBuy(neg, 0, T, true).why, 'poor')       // отрицательный баланс ничего не позволяет
  assert.equal(neg.sh, null)
  // за последний час уже поработал: первый блок стоит 2 — на 1 не хватает, на 2 хватает
  const w = shopSt(100)
  core.shopBuy(w, 0, T, true)
  core.shopStop(w, T + 25 * M)
  w.fb = 3 + 1                                            // три цветка из баланса ещё не подтверждены телефоном
  assert.equal(core.shopBalance(w), 1)
  assert.equal(core.shopBuy(w, 0, T + 26 * M, true).why, 'poor')
  assert.equal(w.sh, null)
  w.fb = 3 + 2
  assert.equal(core.shopBuy(w, 0, T + 26 * M, true).ok, true)
  assert.equal(core.shopBalance(w), 0)
})

t('нет связи (баланс не получен или нет свежего ответа): не продаётся', () => {
  const none = core.newState(false, 60)
  assert.equal(core.shopBalance(none), null)
  assert.equal(core.shopBuy(none, 0, T, true).why, 'nolink')
  const stale = shopSt(50, { '🍚': 3 })
  assert.equal(core.shopBuy(stale, 1, T, false).why, 'nolink')   // кэш есть, но на этом открытии магазина ответа от телефона не было
  assert.equal(core.shopBuy(stale, 0, T, false).why, 'nolink')
  assert.equal(stale.out.length, 0)
  assert.equal(core.setShopFrom(stale, { p: {} }), false)        // ответ без баланса (старый LuvU613)
  assert.equal(core.setShopFrom(stale, null), false)
  assert.equal(core.shopBalance(stale), 50)
})

t('покупка: событие buy с ценой на момент покупки, баланс на экране уменьшается сразу; ответ телефона заменяет баланс', () => {
  const st = shopSt(50, { '🥤': 7 })
  const r = core.shopBuy(st, 2, T, true)
  assert.equal(r.ok, true)
  assert.equal(r.ev.k, 'p')
  assert.equal(r.ev.e, '🥤')
  assert.equal(r.ev.c, 7)
  assert.equal(r.ev.ts, T)
  assert.equal(st.out.length, 1)
  assert.equal(core.shopBalance(st), 43)                 // 50 - 7
  assert.equal(core.anyRunning(st), false)               // у 🥤 таймера нет
  // цена на телефоне сменилась после покупки: на купленное не влияет (событие хранит цену покупки)
  core.setShopFrom(st, { b: 50, p: { '🥤': 100 } })
  assert.equal(st.out[0].c, 7)
  assert.equal(core.shopBalance(st), 43)                 // пока нет ack, неподтверждённая покупка вычитается из присланного баланса
  // ack: событие уходит из очереди, а присланный баланс (уже без 7) заменяет показанный
  assert.equal(core.ack(st, r.ev.id), true)
  core.setShopFrom(st, { b: 43, p: { '🥤': 100 } })
  assert.equal(core.shopBalance(st), 43)                 // не 36: подтверждённая покупка не вычитается дважды
  // две покупки подряд до ack: id разные, баланс вычитает обе
  const s2 = shopSt(20, { '🍚': 5, '🧁': 6 })
  const a = core.shopBuy(s2, 1, T, true)
  const b = core.shopBuy(s2, 3, T, true)
  assert.notEqual(a.ev.id, b.ev.id)
  assert.equal(core.shopBalance(s2), 9)
  assert.equal(core.shopBuy(shopSt(20, { '🍚': 5 }), 1, T, true).ev.id === core.shopBuy(shopSt(20, { '🍚': 5 }), 1, T, true).ev.id, false)
  // на 🥤 за 10 при балансе 9 после двух покупок — отказ
  s2.fp['🥤'] = 10
  assert.equal(core.shopBuy(s2, 2, T, true).why, 'poor')
  // отрицательный баланс с телефона не обрезается и покупок не даёт
  const neg = shopSt(-3, { '🍚': 0 })
  assert.equal(core.shopBalance(neg), -3)
  assert.equal(core.shopBuy(neg, 1, T, true).why, 'poor')
  // неподтверждённые блоки 🌴 тоже вычитаются из баланса, как покупки
  const w = shopSt(20)
  core.shopBuy(w, 0, T, true)
  core.process(w, T + 20 * M)
  assert.equal(core.shopBalance(w), 17)
})

t('обычные товары 🍚 🥤 🧁 🫦 👁️ 💬: только списание и событие, таймера нет; события несут эмодзи товара (👁️ — теперь тоже обычный)', () => {
  const all = shopSt(1000, { '🍚': 1, '🥤': 1, '🧁': 1, '🫦': 1, '👁️': 1, '💬': 1 })
  for (const i of [1, 2, 3, 4, 5, 6]) {
    const r = core.shopBuy(all, i, T + i, true)
    assert.equal(r.ev.e, core.SHOP[i].e)
    assert.equal(r.ev.c, 1)
    assert.equal(all.sh, null)
  }
  assert.equal(core.shopBalance(all), 1000 - 6)
  assert.equal(core.anyRunning(all), false)
})

t('таймер магазина и занятие вместе не запускаются: покупка 🌴 при идущем занятии — отказ; второй 🌴 (идёт или на паузе) — отказ; обычные товары покупаются при таймере', () => {
  const st = shopSt(100, { '🍚': 4 })
  assert.equal(core.shopBuy(st, 0, T, true).ok, true)
  assert.equal(core.shopBuy(st, 0, T + M, true).why, 'busy')
  assert.equal(core.shopBuy(st, 1, T + M, true).ok, true)         // 🍚 — можно
  assert.equal(core.shopBalance(st), 96)
  core.shopTap(st, T + 2 * M)
  assert.equal(core.shopBuy(st, 0, T + 3 * M, true).why, 'busy')   // на паузе — тоже занят
  const s2 = shopSt(100)
  core.toggle(s2, 2, T)
  assert.equal(core.shopBuy(s2, 0, T + 10 * M, true).why, 'busy')
  assert.equal(core.running(s2, 2), true)                         // занятие не трогается
  assert.equal(s2.out.filter((e) => e.k === 'p').length, 0)
  assert.equal(s2.sh, null)
})

t('состояние магазина переживает перезапуск: баланс, цены, отработанные отрезки, идущий / стоящий на паузе таймер; таймеры прошлых версий и мусор отбрасываются', () => {
  const st = shopSt(42, { '🍿': 5, '🍚': 3 })
  core.shopBuy(st, 0, T, true)
  core.process(st, T + 12 * M)
  core.shopStop(st, T + 13 * M)
  const back = core.restore(JSON.stringify(st), false, 60)
  assert.equal(back.fb, 42)
  assert.deepEqual(back.fp, { '🍚': 3 })                        // цена 🍿 от телефона больше не нужна: такого товара нет
  assert.deepEqual(back.su, [[T, T + 13 * M]])
  assert.equal(back.out.length, 1)
  assert.equal(back.out[0].k, 'p')
  assert.equal(core.shopBalance(back), 41)
  assert.equal(core.shopRate(back, T + 14 * M), 1)               // за час 13 минут
  assert.equal(core.shopRate(back, T + 80 * M), 0)               // окно ушло вперёд (отрезок вышел из часа)
  // идущий и стоящий на паузе таймер магазина
  const run = shopSt(42)
  core.shopBuy(run, 0, T, true)
  core.shopTap(run, T + 2 * M)
  const r1 = core.restore(JSON.stringify(run), false, 60)
  assert.equal(r1.sh.k, 'g')
  assert.equal(r1.sh.run, 0)
  assert.equal(r1.sh.el, 2 * M)
  assert.equal(r1.sh.n, 1)
  assert.equal(core.shopLabel(r1, T + 50 * M), '2')
  core.shopTap(r1, T + 10 * M)
  const r2 = core.restore(JSON.stringify(r1), false, 60)
  assert.equal(r2.sh.run, T + 10 * M)
  assert.equal(core.process(r2, T + 18 * M).shop, true)          // 2 + 8 = 10 минут работы — первый платный блок
  assert.equal(r2.out[0].c, 1)
  // таймер из прошлой версии (красный / зелёный, без счётчика блоков), мусор и красный экран из старой версии — отбрасываются
  const oldSh = { i: 2, k: 'g', run: T, el: 0, c: 5, paid: 1, len: 60 * M, chg: 5 * M }
  assert.equal(core.restore(JSON.stringify({ v: 6, run: [0, 0, 0, 0, 0, 0], sh: oldSh }), false, 60).sh, null)
  assert.equal(core.restore(JSON.stringify({ v: 6, run: [0, 0, 0, 0, 0, 0], sh: { i: 0, k: 'r', run: T, el: 0, c: 2, paid: 0, len: 15 * M, chg: 5 * M } }), false, 60).sh, null)
  assert.equal(core.restore(JSON.stringify({ v: 6, run: [0, 0, 0, 0, 0, 0], q: { k: 'g', s: 1, run: T } }), false, 60).q.s, 0)
  assert.deepEqual(core.restore(JSON.stringify({ v: 6, run: [0, 0, 0, 0, 0, 0], su: [[1, 2], 'x', [5, 3], null] }), false, 60).su, [[1, 2]])
  // занятие, пока таймер стоял в памяти: вместе они не бывают
  const both = core.restore(JSON.stringify({ v: 6, run: [T, 0, 0, 0, 0, 0], sh: { i: 0, k: 'g', run: T, el: 0, n: 1 } }), false, 60)
  assert.equal(both.sh, null)
  // чужие и неверные цены не попадают; 🌴 в списке цен не бывает
  assert.deepEqual(core.cleanPrices({ '🌴': 99, '🍿': -1, '🍚': '5', '🥤': 2.6, '💬': 0, x: 1 }), { '🥤': 3, '💬': 0 })
  assert.deepEqual(core.cleanPrices(null), {})
  const old = core.restore(JSON.stringify({ v: 6, run: [0, 0, 0, 0, 0, 0], val: 60, queue: [], out: [], hg: [T] }), false, 60)
  assert.equal(old.fb, null)
  assert.deepEqual(old.su, [])
  assert.equal(old.hg, undefined)
})

t('телефон 5.18: ответ sync целиком — баланс (может быть отрицательным) и цены только обычных товаров', () => {
  const st = core.newState(false, 60)
  const reply = { t: 'sync', f: { b: -4, p: { '🍿': 6, '🌴': 8, '👁️': 3 } }, g: { n: 0, h: 0 } }
  assert.equal(core.setShopFrom(st, reply.f), true)
  assert.equal(core.shopBalance(st), -4)
  assert.equal(core.shopPrice(st, 5, T), 3)                       // 👁️ — теперь обычная покупка с ценой телефона
  assert.equal(core.shopPrice(st, 1, T), null)
  assert.equal(core.shopPrice(st, 0, T), 0)                       // 🌴: цену телефона игнорируем — правило часов
})

t('будильников у таймера магазина нет (срока нет, блоки считаются по меткам времени)', () => {
  const st = shopSt(100)
  core.shopBuy(st, 0, T, true)
  assert.equal(core.nextDue(st).length, 0)
  assert.equal(core.alarmPlan(st, core.aheadFor(st)).length, 0)
})

t('вызов очереди из ячейки долгим нажатием: пусто / другая — заменить шестью; ровно эти шесть — удвоить (12); уже удвоено — ничего', () => {
  const A = ['🧬', '💀', '🩸', '🤖', '🧭', '📖']
  const B = ['📖', '🧭', '🤖', '🩸', '💀', '🧬']
  assert.deepEqual(core.slotQueue([], A), A)                               // очередь пуста — шесть из ячейки
  assert.deepEqual(core.slotQueue(A, A), A.concat(A))                      // та же ячейка ещё раз — удвоение до 12
  assert.equal(core.slotQueue(A.concat(A), A), null)                       // третье нажатие ничего не делает
  assert.deepEqual(core.slotQueue(A, B), B)                                // другая ячейка заменяет очередь
  assert.deepEqual(core.slotQueue(A.concat(A), B), B)                      // и удвоенную тоже
  assert.deepEqual(core.slotQueue(['🏠', '🔍'], A), A)                     // любая другая очередь — тоже замена
  assert.deepEqual(core.slotQueue(A.slice(1), A), A)                       // из шести уже убрано занятие (конец промежутка) — не «ровно эти шесть»: замена
  assert.equal(core.slotQueue(A, []), null)                                // пустая ячейка — ничего
  assert.equal(core.slotQueue(A, A.slice(0, 5)), null)                     // в ячейке не шесть — ничего
  assert.equal(core.slotQueue(A.concat(A, A), A), null)                    // очередь длиннее 12 обрезается до 12 — это удвоенная ячейка
  const q = core.slotQueue(A, A)
  assert.equal(q.length, core.QUEUE_MAX)                                    // удвоенная очередь помещается ровно
})

t('запись очереди для телефона: уходит один раз — при удалении недоделанной и при полном выполнении', () => {
  const Q = ['📖', '🏠', '📖', '🏠', '📖', '🏠']
  const st = core.newState(false, 30)
  st.queue = Q.slice()
  st.auto = true; st.ta = T
  core.startAuto(st, T)
  core.process(st, T + 3 * 30 * M + 10 * M)          // три занятия готовы, четвёртое на середине
  assert.equal(st.queue.length, 3)
  assert.equal(st.out.filter(e => e.k === 'qr').length, 0)   // в очереди ещё есть эмодзи — телефону ничего
  st.auto = false
  const ev = core.setQueue(st, [], T + 4 * 30 * M)    // очередь удалена
  assert.equal(ev.k, 'qr'); assert.equal(ev.ts, T); assert.equal(ev.v, 30)
  assert.equal(ev.q, Q.join('')); assert.equal(ev.m, '111000')
  assert.equal(st.qs, null)
  const st2 = core.newState(false, 30)
  st2.queue = Q.slice()
  core.startAuto(st2, T)
  core.process(st2, T + 6 * 30 * M)                    // выполнено всё
  const all = st2.out.filter(e => e.k === 'qr')
  assert.equal(all.length, 1); assert.equal(all[0].m, '111111'); assert.equal(all[0].ts, T)
  const st3 = core.newState(false, 30)
  st3.queue = Q.slice()
  assert.equal(core.setQueue(st3, [], T), null)       // ничего не выполнено — записи нет
})

console.log('\nВсе проверки пройдены: ' + n)

t('нажатие на экран = временная пауза 🩸: занятие замораживается, автостарт ждёт, возврат с того же места; 🩸 — моно и в журнал от часа', () => {
  // моно 🤖 (ценность 30): 10 минут прошло, нажатие -> 🩸 идёт 65 минут, нажатие -> 🤖 продолжает с 10-й минуты
  const st = core.newState(false, 30)
  core.toggle(st, 3, T)
  core.tapOverlay(st, T + 10 * M)
  assert.equal(st.run[3], 0)
  assert.equal(st.run[2], T + 10 * M)
  assert.equal(core.overlayKind(st), 'a')
  core.tapOverlay(st, T + 75 * M)
  assert.equal(st.hold, null)
  assert.equal(st.run[2], 0)
  assert.equal(st.run[3], T + 65 * M)                      // 75 - 10: круг продолжается с той же минуты
  assert.equal(core.remaining(st, 3, T + 75 * M), 20 * M)
  const mo = st.out.filter(e => e.k === 'mo')
  assert.equal(mo.length, 1)                               // два полных круга 🩸 по 30 = 60 >= 60
  assert.equal(core.EMOJI[mo[0].i], '🩸')
  assert.equal(mo[0].n, 2)
  assert.equal(st.mono.i, 3)                               // моно 🤖 продолжается
  // автостарт: 🏠 первым — пауза не закрывает его, возврат включает автостарт
  const sa = core.newState(false, 30)
  sa.queue = ['🏠', '📖']
  core.startAuto(sa, T)
  core.tapOverlay(sa, T + 5 * M)
  assert.equal(sa.auto, false)
  assert.equal(sa.q.s, 0)
  core.process(sa, T + 50 * M)                             // 🩸 идёт, очередь не двигается
  assert.deepEqual(sa.queue, ['🏠', '📖'])
  core.tapOverlay(sa, T + 50 * M)
  assert.equal(sa.auto, true)
  assert.equal(sa.q.run, T + 45 * M)
  core.process(sa, T + 75 * M)                             // 🏠 закрылся на 30-й минуте своего круга, пошёл 📖
  assert.deepEqual(sa.queue, ['📖'])
  // 🩸 уже идёт обычным запуском — нажатие ничего не делает; остановить совсем во время паузы отпускает замороженное
  const sb = core.newState(false, 30)
  core.toggle(sb, 2, T)
  assert.equal(core.tapOverlay(sb, T + M).changed, false)
  const sc = core.newState(false, 30)
  core.toggle(sc, 3, T)
  core.tapOverlay(sc, T + 10 * M)
  core.stopAll(sc, T + 20 * M)
  assert.equal(sc.hold, null)
  assert.equal(core.anyRunning(sc), false)
  assert.equal(sc.out.filter(e => e.k === 'b' && e.f === 0).length, 2)   // и 🩸, и замороженное 🤖 отправили пройденное
  // перезапуск приложения в паузе ничего не теряет
  const sd = core.newState(false, 30)
  sd.queue = ['🤖', '📖']
  core.startAuto(sd, T)
  core.tapOverlay(sd, T + 7 * M)
  const sr = core.restore(JSON.stringify(sd), false, 30)
  assert.equal(sr.hold.a, 3)
  assert.equal(sr.hold.auto, true)
  assert.equal(sr.hold.el, 7 * M)
})
