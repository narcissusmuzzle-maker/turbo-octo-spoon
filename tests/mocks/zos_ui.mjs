// Заглушка @zos/ui: записывает все созданные виджеты (globalThis.__W) вместо рисования; setProperty сливает свойства, VISIBLE хранится в w.visible.
globalThis.__W = globalThis.__W || []
let nextId = 1
export const widget = { FILL_RECT: 'FILL_RECT', IMG: 'IMG', TEXT: 'TEXT', BUTTON: 'BUTTON' }
export const align = { LEFT: 'L', CENTER_H: 'CH', CENTER_V: 'CV', TOP: 'T' }
export const text_style = { WRAP: 'WRAP' }
export const prop = { MORE: 'MORE', VISIBLE: 'VISIBLE' }
export function createWidget(type, props) {
  const w = { id: nextId++, type, props: { ...props }, alive: true, visible: true }
  w.setProperty = function (p, v) { if (p === 'VISIBLE') w.visible = !!v; else if (p === 'MORE') Object.assign(w.props, v) }
  globalThis.__W.push(w)
  return w
}
export function setStatusBarVisible(v) { globalThis.__STATUSBAR = v }
