/** Joins truthy class names: cx('a', cond && 'b', undefined) -> "a b" */
export default function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
