import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '@/api/client'
import { Field, Spinner } from '@/components/ui'
import { useT } from '@/i18n'
import { whatsappLink } from '@/lib/format'
import { useDocumentTitle, useSettings } from '@/lib/hooks'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/store/toast'
import { safeNext } from '@/lib/validation'

export default function LoginPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const status = useAuthStore((s) => s.status)
  const role = useAuthStore((s) => s.user?.role)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgot, setForgot] = useState(false)
  const { data: settings } = useSettings()
  useDocumentTitle(t.login)

  const nextParam = params.get('next')

  const mutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: (user) => {
      toast.success(`${t.hello}, ${user.fullName}!`)
    },
  })

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(safeNext(nextParam, role === 'ADMIN' ? '/admin' : '/account'), { replace: true })
    }
  }, [status, role, nextParam, navigate])

  return (
    <form
      className="panel auth-card"
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
    >
      <div>
        <span className="eyebrow">Greenleaf</span>
        <h1>{t.login}</h1>
      </div>
      <Field label={t.email}>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </Field>
      <Field label={t.password}>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      {mutation.isError && <div className="notice error">{errorMessage(mutation.error)}</div>}
      <button type="button" className="link-btn small" style={{ justifySelf: 'start' }} onClick={() => setForgot((v) => !v)}>
        {t.forgotPassword}
      </button>
      {forgot && (
        <div className="notice">
          <span>
            {t.forgotPasswordHint}{' '}
            {settings?.whatsapp && (
              <a
                className="btn-link"
                href={whatsappLink(settings.whatsapp, `Здравствуйте! Не могу войти в аккаунт${email.trim() ? ` (${email.trim()})` : ''} — нужен временный пароль.`)}
                target="_blank"
                rel="noreferrer"
              >
                {t.writeWhatsapp}
              </a>
            )}
          </span>
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={mutation.isPending || !email || !password}>
        {mutation.isPending ? <Spinner /> : t.login}
      </button>
      <p className="muted small" style={{ textAlign: 'center' }}>
        {t.noAccount}{' '}
        <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="btn-link">
          {t.register}
        </Link>
      </p>
    </form>
  )
}
