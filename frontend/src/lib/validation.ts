/**
 * Only same-origin relative paths are allowed as post-login redirects. Browsers treat "/\\host" like "//host", and
 * strip tabs/newlines from URLs, so those are refused too.
 */
export function safeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || /^\/[/\\]/.test(value) || /[\u0000-\u001f\\]/.test(value)) return fallback
  return value
}

export function passwordProblem(value: string): string | null {
  return value.length < 8 || !/\d/.test(value) || !/[A-Za-zА-Яа-яЁё]/.test(value)
    ? 'От 8 символов, минимум одна буква и одна цифра'
    : null
}

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim())
