globalThis.__FS = globalThis.__FS || {}
export function readFileSync(o) { if (!(o.path in globalThis.__FS)) throw new Error('нет файла'); return globalThis.__FS[o.path] }
export function writeFileSync(o) { globalThis.__FS[o.path] = o.data }
