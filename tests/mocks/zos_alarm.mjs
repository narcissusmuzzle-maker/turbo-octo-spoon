let id = 1
export function set(o) { globalThis.__ALARMS = (globalThis.__ALARMS || []).concat([o]); return id++ }
export function cancel() {}
