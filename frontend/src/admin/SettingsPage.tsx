import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type CompanyVideo, type StoreSettings, type StoreSettingsUpdate } from '@/api/admin'
import { errorMessage } from '@/api/client'
import { Field, PageLoader, Spinner } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { fileSize } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { parseVideo } from '@/lib/video'
import { toast } from '@/store/toast'
import { AdminHead, moneyOrNull, nullIfBlank, Toggle } from './shared'

const MAX_VIDEO_BYTES = 200 * 1024 * 1024

function CompanyVideoSettings({ video }: { video: CompanyVideo }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(video.uploaded ? '' : (video.url ?? ''))
  const [title, setTitle] = useState(video.title ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUrl(video.uploaded ? '' : (video.url ?? ''))
    setTitle(video.title ?? '')
  }, [video])

  const applied = (next: CompanyVideo, message: string) => {
    queryClient.setQueryData(['admin', 'company-video'], next)
    void queryClient.invalidateQueries({ queryKey: ['settings'] })
    toast.success(message)
  }

  const saveLink = useMutation({
    mutationFn: () => adminApi.setCompanyVideoLink({ url: nullIfBlank(url), title: nullIfBlank(title) }),
    onSuccess: (next) => applied(next, 'Видео сохранено'),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const upload = useMutation({
    mutationFn: (f: File) => adminApi.uploadCompanyVideo(f, nullIfBlank(title), setProgress),
    onSuccess: (next) => {
      setFile(null)
      applied(next, 'Видео загружено')
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => setProgress(0),
  })

  const reset = useMutation({
    mutationFn: adminApi.resetCompanyVideo,
    onSuccess: (next) => applied(next, 'Вернули видео по умолчанию'),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const urlInvalid = url.trim() !== '' && !parseVideo(url)
  const fileError = file && file.size > MAX_VIDEO_BYTES ? `Файл больше 200 МБ (${fileSize(file.size)})` : null
  const busy = saveLink.isPending || upload.isPending || reset.isPending

  return (
    <div className="editor-layout">
      <div className="stack" style={{ gap: 16 }}>
        <section className="panel editor-section">
          <h3>Видео о компании на главной</h3>
          <p className="muted small">
            Показывается на главной странице под слоганом. Можно указать ссылку на YouTube/Vimeo или загрузить свой файл (MP4, WEBM, MOV до 200 МБ).
          </p>
          <Field label="Ссылка на видео" error={urlInvalid ? 'Нужна ссылка, начинающаяся с http:// или https://' : undefined} hint={video.uploaded ? 'Сейчас показывается загруженный файл. Сохранение ссылки заменит его.' : undefined}>
            <input className="input" value={url} maxLength={500} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setUrl(e.target.value.trim())} />
          </Field>
          <Field label="Подпись под видео">
            <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="row wrap">
            <button type="button" className="btn btn-primary" disabled={busy || urlInvalid || (!url.trim() && !video.uploaded && !title.trim())} onClick={() => saveLink.mutate()}>
              {saveLink.isPending ? <Spinner /> : 'Сохранить ссылку и подпись'}
            </button>
          </div>
        </section>

        <section className="panel editor-section">
          <h3>Или загрузить файл</h3>
          <div className="row wrap">
            <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={busy}>
              Выбрать видео…
            </button>
            {file && (
              <span className="muted small">
                {file.name} · {fileSize(file.size)}
              </span>
            )}
            <input
              ref={input}
              type="file"
              hidden
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
          {fileError && <span className="small" style={{ color: 'var(--danger)' }}>{fileError}</span>}
          {upload.isPending && (
            <div className="progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="row">
            <button type="button" className="btn btn-gold" disabled={!file || !!fileError || busy} onClick={() => file && upload.mutate(file)}>
              {upload.isPending ? `Загрузка ${progress}%` : 'Загрузить и показать на главной'}
            </button>
          </div>
        </section>
      </div>

      <aside className="editor-side">
        <section className="panel editor-section">
          <h3>Сейчас на сайте</h3>
          {video.url ? <VideoPlayer url={video.url} title={video.title} showTitle={false} /> : <p className="muted small">Видео не задано.</p>}
          {video.title && <strong>{video.title}</strong>}
          <span className="muted small">
            {video.uploaded ? 'Загруженный файл' : video.custom ? 'Ссылка из админки' : 'Видео по умолчанию (из настроек сервера)'}
          </span>
          {(video.custom || video.uploaded) && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm('Вернуть видео по умолчанию?') && reset.mutate()}>
              {reset.isPending ? <Spinner /> : 'Вернуть по умолчанию'}
            </button>
          )}
        </section>
      </aside>
    </div>
  )
}

interface StoreForm {
  phone: string
  whatsapp: string
  telegramUrl: string
  instagramUrl: string
  city: string
  address: string
  workingHours: string
  deliveryFee: string
  freeDeliveryThreshold: string
  freeDeliveryRetailOnly: boolean
  partnerDiscountPercent: string
  telegramBotToken: string
  telegramChatId: string
}

const toForm = (s: StoreSettings): StoreForm => ({
  phone: s.phone ?? '',
  whatsapp: s.whatsapp ?? '',
  telegramUrl: s.telegramUrl ?? '',
  instagramUrl: s.instagramUrl ?? '',
  city: s.city ?? '',
  address: s.address ?? '',
  workingHours: s.workingHours ?? '',
  deliveryFee: String(s.deliveryFee ?? ''),
  freeDeliveryThreshold: String(s.freeDeliveryThreshold ?? ''),
  freeDeliveryRetailOnly: s.freeDeliveryRetailOnly,
  partnerDiscountPercent: String(s.partnerDiscountPercent ?? ''),
  telegramBotToken: '',
  telegramChatId: s.telegramChatId ?? '',
})

const isUrl = (v: string) => v.trim() === '' || /^https?:\/\/\S+$/.test(v.trim())

function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<StoreForm>(() => toForm(settings))
  const initial = useRef(JSON.stringify(toForm(settings)))
  const dirty = JSON.stringify(form) !== initial.current
  const set = <K extends keyof StoreForm>(key: K, value: StoreForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const fee = moneyOrNull(form.deliveryFee)
  const threshold = moneyOrNull(form.freeDeliveryThreshold)
  const discount = Number(form.partnerDiscountPercent)
  const errors: Partial<Record<keyof StoreForm, string>> = {}
  if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 10) errors.phone = 'Номер целиком, например +7 707 123 45 67'
  if (form.whatsapp.trim() && form.whatsapp.replace(/\D/g, '').length < 10) errors.whatsapp = 'Номер целиком, например 77071234567'
  if (!isUrl(form.telegramUrl)) errors.telegramUrl = 'Ссылка должна начинаться с https://'
  if (!isUrl(form.instagramUrl)) errors.instagramUrl = 'Ссылка должна начинаться с https://'
  if (fee == null || fee < 0 || !Number.isInteger(fee)) errors.deliveryFee = 'Целое число тенге, 0 — бесплатно'
  if (threshold == null || threshold < 0 || !Number.isInteger(threshold)) errors.freeDeliveryThreshold = 'Целое число тенге, 0 — доставка всегда платная'
  if (!/^\d{1,2}$/.test(form.partnerDiscountPercent.trim()) || discount > 90) errors.partnerDiscountPercent = 'От 0 до 90'
  const invalid = Object.keys(errors).length > 0

  const save = useMutation({
    mutationFn: () => {
      const body: StoreSettingsUpdate = {
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        telegramUrl: form.telegramUrl.trim(),
        instagramUrl: form.instagramUrl.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        workingHours: form.workingHours.trim(),
        deliveryFee: fee!,
        freeDeliveryThreshold: threshold!,
        freeDeliveryRetailOnly: form.freeDeliveryRetailOnly,
        partnerDiscountPercent: discount,
        telegramChatId: form.telegramChatId.trim(),
        // An empty token field means "keep the saved one"; removing it is a separate button.
        telegramBotToken: form.telegramBotToken.trim() || null,
      }
      return adminApi.saveStoreSettings(body)
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['admin', 'store-settings'], next)
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['product'] })
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      const nextForm = toForm(next)
      initial.current = JSON.stringify(nextForm)
      setForm(nextForm)
      toast.success('Настройки сохранены')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const removeToken = useMutation({
    mutationFn: () => adminApi.saveStoreSettings({ telegramBotToken: '' }),
    onSuccess: (next) => {
      queryClient.setQueryData(['admin', 'store-settings'], next)
      toast.success('Токен бота удалён — уведомления выключены')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const test = useMutation({
    mutationFn: () =>
      adminApi.telegramTest({ telegramBotToken: form.telegramBotToken.trim() || null, telegramChatId: form.telegramChatId.trim() || null }),
    onSuccess: () => toast.success('Сообщение отправлено — проверьте Telegram'),
    onError: (e) => toast.error(errorMessage(e)),
  })

  const busy = save.isPending || removeToken.isPending

  return (
    <form
      className="editor-layout"
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) save.mutate()
      }}
    >
      <div className="stack" style={{ gap: 16 }}>
        <section className="panel editor-section">
          <h3>Контакты магазина</h3>
          <p className="muted small">Показываются в шапке, подвале, на странице заказа. Заказы приходят в WhatsApp на этот номер.</p>
          <div className="grid-2">
            <Field label="Телефон" error={errors.phone}>
              <input className="input" value={form.phone} maxLength={32} inputMode="tel" onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="WhatsApp (только цифры)" error={errors.whatsapp} hint="Например 77071234567">
              <input className="input" value={form.whatsapp} maxLength={20} inputMode="tel" onChange={(e) => set('whatsapp', e.target.value)} />
            </Field>
            <Field label="Город">
              <input className="input" value={form.city} maxLength={100} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="Адрес самовывоза">
              <input className="input" value={form.address} maxLength={300} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Часы работы" hint="Например «Пн–Сб 10:00–19:00». Пусто — не показывать">
              <input className="input" value={form.workingHours} maxLength={120} onChange={(e) => set('workingHours', e.target.value)} />
            </Field>
            <Field label="Telegram-канал" error={errors.telegramUrl}>
              <input className="input" value={form.telegramUrl} maxLength={300} placeholder="https://t.me/…" onChange={(e) => set('telegramUrl', e.target.value)} />
            </Field>
            <Field label="Instagram" error={errors.instagramUrl} hint="Пусто — иконка не показывается">
              <input className="input" value={form.instagramUrl} maxLength={300} placeholder="https://instagram.com/…" onChange={(e) => set('instagramUrl', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="panel editor-section">
          <h3>Доставка и партнёрская цена</h3>
          <div className="grid-2">
            <Field label="Стоимость доставки, ₸" error={errors.deliveryFee}>
              <input className="input" value={form.deliveryFee} inputMode="numeric" onChange={(e) => set('deliveryFee', e.target.value)} />
            </Field>
            <Field label="Бесплатная доставка от, ₸" error={errors.freeDeliveryThreshold} hint="0 — бесплатной доставки нет">
              <input className="input" value={form.freeDeliveryThreshold} inputMode="numeric" onChange={(e) => set('freeDeliveryThreshold', e.target.value)} />
            </Field>
            <Field label="Партнёрская скидка, %" error={errors.partnerDiscountPercent} hint="Для товаров без своей партнёрской цены">
              <input className="input" value={form.partnerDiscountPercent} inputMode="numeric" maxLength={2} onChange={(e) => set('partnerDiscountPercent', e.target.value)} />
            </Field>
          </div>
          <label className="row" style={{ gap: 10 }}>
            <Toggle checked={form.freeDeliveryRetailOnly} onChange={(v) => set('freeDeliveryRetailOnly', v)} label="Бесплатная доставка только для розницы" />
            <span>Бесплатная доставка только для розничных покупателей (партнёры платят всегда)</span>
          </label>
        </section>

        <section className="panel editor-section">
          <h3>Уведомления о новых заказах в Telegram</h3>
          <p className="muted small">
            1) В Telegram откройте <b>@BotFather</b>, отправьте <code>/newbot</code> и получите токен. 2) Напишите своему боту любое сообщение
            (или добавьте его в группу). 3) Узнайте ID чата у <b>@userinfobot</b> (для группы ID начинается с «-»). 4) Вставьте оба значения и нажмите
            «Проверить».
          </p>
          <div className="grid-2">
            <Field
              label="Токен бота"
              hint={settings.telegramTokenHint ? `Сохранён (заканчивается на ${settings.telegramTokenHint.replace('…', '')}). Пусто — оставить как есть` : 'Не задан'}
            >
              <input
                className="input"
                value={form.telegramBotToken}
                maxLength={100}
                autoComplete="off"
                placeholder="123456789:AA…"
                onChange={(e) => set('telegramBotToken', e.target.value.trim())}
              />
            </Field>
            <Field label="ID чата">
              <input className="input" value={form.telegramChatId} maxLength={40} placeholder="-1001234567890" onChange={(e) => set('telegramChatId', e.target.value.trim())} />
            </Field>
          </div>
          <div className="row wrap">
            <button type="button" className="btn btn-ghost btn-sm" disabled={test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? <Spinner /> : 'Проверить — отправить пробное сообщение'}
            </button>
            {settings.telegramTokenHint && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => window.confirm('Удалить токен бота? Уведомления о заказах перестанут приходить.') && removeToken.mutate()}
              >
                Удалить токен
              </button>
            )}
            <span className={settings.telegramConfigured ? 'badge badge-green' : 'badge badge-gray'}>
              {settings.telegramConfigured ? 'Уведомления включены' : 'Уведомления выключены'}
            </span>
          </div>
        </section>
      </div>

      <aside className="editor-side">
        <section className="panel editor-section">
          <h3>Сохранение</h3>
          <p className="muted small">Изменения сразу видны покупателям. Пустое поле контакта — вернуть значение из настроек сервера.</p>
          <button type="submit" className="btn btn-primary" disabled={busy || invalid || !dirty}>
            {save.isPending ? <Spinner /> : dirty ? 'Сохранить' : 'Сохранено'}
          </button>
          {dirty && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setForm(JSON.parse(initial.current) as StoreForm)}>
              Отменить изменения
            </button>
          )}
        </section>
      </aside>
    </form>
  )
}

export default function SettingsPage() {
  useDocumentTitle('Настройки сайта')
  const video = useQuery({ queryKey: ['admin', 'company-video'], queryFn: adminApi.companyVideo })
  const store = useQuery({ queryKey: ['admin', 'store-settings'], queryFn: adminApi.storeSettings })

  return (
    <>
      <AdminHead eyebrow="Витрина" title="Настройки сайта" />
      <div className="stack" style={{ gap: 28 }}>
        {store.isLoading || !store.data ? <PageLoader /> : <StoreSettingsForm key={JSON.stringify(store.data)} settings={store.data} />}
        {video.isLoading || !video.data ? <PageLoader /> : <CompanyVideoSettings video={video.data} />}
      </div>
    </>
  )
}
