/** Only same-origin relative paths are allowed as post-login redirects. */
export function safeNext(value: string | null, fallback: string) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

export function passwordProblem(value: string): string | null {
  return value.length < 8 || !/\d/.test(value) || !/[A-Za-zА-Яа-яЁё]/.test(value)
    ? 'От 8 символов, минимум одна буква и одна цифра'
    : null
}

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim())
