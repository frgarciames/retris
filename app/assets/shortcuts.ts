export const F4_SHORTCUT = 'F4'

export function isF4Shortcut(key: string): boolean {
  return key === F4_SHORTCUT
}

export function shouldRunF4Shortcut(key: string, repeat: boolean): boolean {
  return isF4Shortcut(key) && !repeat
}
