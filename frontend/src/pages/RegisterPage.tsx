import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { problemOf } from '@/api/client'
import { Field, PhoneInput, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { isValidPhone } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/store/toast'
import { isEmail, passwordProblem, safeNext } from '@/lib/validation'

export default function RegisterPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const register = useAuthStore((s) => s.register)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useDocumentTitle(t.register)

  const mutation = useMutation({
    mutationFn: () =>
      register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone || undefined,
        consent,
      }),
    onSuccess: (user) => {
      toast.success(`${t.welcome}, ${user.fullName}!`)
      navigate(safeNext(params.get('next'), '/account'), { replace: true })
    },
    onError: (error) => setErrors(problemOf(error).errors ?? {}),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (form.fullName.trim().length < 2) e.fullName = t.errName
    if (!isEmail(form.email)) e.email = t.errEmail
    if (form.phone && !isValidPhone(form.phone)) e.phone = t.errPhone
    if (passwordProblem(form.password)) e.password = t.errPassword
    if (!consent) e.consent = t.errConsentRegister
    setErrors(e)
    if (!Object.keys(e).length) mutation.mutate()
  }

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <form
      className="panel auth-card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div>
        <span className="eyebrow">Greenleaf</span>
        <h1>{t.register}</h1>
      </div>
      <Field label={t.fullName} error={errors.fullName}>
        <input className={clsx('input', errors.fullName && 'invalid')} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" autoFocus />
      </Field>
      <Field label={t.email} error={errors.email}>
        <input className={clsx('input', errors.email && 'invalid')} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
      </Field>
      <Field label={`${t.phone} (${t.optional})`} error={errors.phone}>
        <PhoneInput className={clsx('input', errors.phone && 'invalid')} value={form.phone} onChange={(v: string) => set('phone', v)} />
      </Field>
      <Field label={t.password} error={errors.password} hint={t.passwordHint}>
        <input className={clsx('input', errors.password && 'invalid')} type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
      </Field>
      <label className={clsx('consent', errors.consent && 'invalid')}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked)
            setErrors(({ consent: _c, ...rest }) => rest)
          }}
        />
        <span>
          {t.consentRegisterLabel}{' '}
          <Link to="/privacy" target="_blank" className="btn-link">
            {t.consentLink}
          </Link>
        </span>
      </label>
      {errors.consent && <small className="field-error">{errors.consent}</small>}
      {mutation.isError && !Object.keys(errors).length && <div className="notice error">{problemOf(mutation.error).detail}</div>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={mutation.isPending}>
        {mutation.isPending ? <Spinner /> : t.register}
      </button>
      <p className="muted small" style={{ textAlign: 'center' }}>
        {t.haveAccount}{' '}
        <Link to="/login" className="btn-link">
          {t.login}
        </Link>
      </p>
    </form>
  )
}
