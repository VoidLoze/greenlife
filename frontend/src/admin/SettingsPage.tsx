import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type CompanyVideo } from '@/api/admin'
import { errorMessage } from '@/api/client'
import { Field, PageLoader, Spinner } from '@/components/ui'
import { VideoPlayer } from '@/components/VideoPlayer'
import { fileSize } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { parseVideo } from '@/lib/video'
import { toast } from '@/store/toast'
import { AdminHead, nullIfBlank } from './shared'

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

export default function SettingsPage() {
  useDocumentTitle('Настройки сайта')
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'company-video'], queryFn: adminApi.companyVideo })

  return (
    <>
      <AdminHead eyebrow="Витрина" title="Настройки сайта" />
      {isLoading || !data ? <PageLoader /> : <CompanyVideoSettings video={data} />}
    </>
  )
}
