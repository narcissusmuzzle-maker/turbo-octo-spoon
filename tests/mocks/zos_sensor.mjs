export const VIBRATOR_SCENE_DURATION_LONG = 2
export const VIBRATOR_SCENE_SHORT_LIGHT = 1
export const VIBRATOR_SCENE_DURATION = 3
export class Vibrator { start(o) { globalThis.__VIB = (globalThis.__VIB || 0) + 1 } }
