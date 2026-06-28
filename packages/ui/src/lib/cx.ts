/** Join truthy class fragments. A dependency-free `clsx` for primitive className composition. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
