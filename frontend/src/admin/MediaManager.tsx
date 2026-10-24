import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { adminApi, type AdminProduct } from '@/api/admin'
import { errorMessage } from '@/api/client'
import type { Media, MediaKind } from '@/api/types'
import { DragIcon, UploadIcon } from '@/components/Icons'
import { Select } from '@/components/Select'
import { Field, Modal, Spinner } from '@/components/ui'
import { fileSize } from '@/lib/format'
import { toast } from '@/store/toast'
import { mediaKindLabel } from './shared'

const MAX_BYTES = 25 * 1024 * 1024
const MAX_VIDEO_BYTES = 200 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const DOC_EXT = /\.(pdf|docx?|xlsx?|txt)$/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i

const isVideoFile = (file: File) => file.type.startsWith('video/') || VIDEO_EXT.test(file.name)

interface QueuedFile {
  id: number
  file: File
  preview: string | null
  kind: MediaKind
  title: string
  description: string
  progress: number
  state: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

let nextQueueId = 1

function guessKind(file: File, fallback: MediaKind): MediaKind {
  if (isVideoFile(file)) return 'VIDEO'
  if (!IMAGE_TYPES.includes(file.type)) return 'DOCUMENT'
  if (/(screen|скрин|снимок|catalog|каталог|page)/i.test(file.name)) return 'SCREENSHOT'
  return fallback === 'DOCUMENT' || fallback === 'VIDEO' ? 'PHOTO' : fallback
}

function validateFile(file: File, kind: MediaKind): string | null {
  if (kind === 'VIDEO') {
    if (!isVideoFile(file)) return 'Видео: MP4, WEBM или MOV'
    return file.size > MAX_VIDEO_BYTES ? `Видео больше 200 МБ (${fileSize(file.size)})` : null
  }
  if (isVideoFile(file)) return 'Это видео — выберите тип «Видео»'
  if (file.size > MAX_BYTES) return `Файл больше 25 МБ (${fileSize(file.size)})`
  const isImage = IMAGE_TYPES.includes(file.type)
  if (kind !== 'DOCUMENT' && !isImage) return 'Для фото и скринов: JPG, PNG, WEBP или GIF'
  if (kind === 'DOCUMENT' && !isImage && !DOC_EXT.test(file.name)) return 'Документы: PDF, DOC/DOCX, XLS/XLSX, TXT или изображения'
  return null
}

function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 200)
}

function extensionOf(media: Media) {
  const ext = (media.originalFilename ?? media.url).split('.').pop()?.toUpperCase() ?? 'FILE'
  return ext.length > 4 ? 'FILE' : ext
}

function UploadQueue({ productId, onUploaded }: { productId: number; onUploaded: () => Promise<void> }) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [defaultKind, setDefaultKind] = useState<MediaKind>('PHOTO')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const queueRef = useRef(queue)
  queueRef.current = queue

  useEffect(() => () => queueRef.current.forEach((q) => q.preview && URL.revokeObjectURL(q.preview)), [])

  const addFiles = (files: FileList | File[]) => {
    const items = Array.from(files).map<QueuedFile>((file) => {
      const kind = guessKind(file, defaultKind)
      return {
        id: nextQueueId++,
        file,
        preview: IMAGE_TYPES.includes(file.type) || isVideoFile(file) ? URL.createObjectURL(file) : null,
        kind,
        title: kind === 'DOCUMENT' ? titleFromFilename(file.name) : '',
        description: '',
        progress: 0,
        state: 'pending',
        error: validateFile(file, kind) ?? undefined,
      }
    })
    setQueue((q) => [...q, ...items])
  }

  const patch = (id: number, changes: Partial<QueuedFile>) =>
    setQueue((q) =>
      q.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...changes }
        if (changes.kind) next.error = validateFile(next.file, next.kind) ?? undefined
        return next
      }),
    )

  const removeItem = (id: number) =>
    setQueue((q) => {
      const item = q.find((i) => i.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return q.filter((i) => i.id !== id)
    })

  const uploadAll = async () => {
    setBusy(true)
    let uploaded = 0
    for (const item of queue) {
      if (item.state === 'done' || item.error) continue
      patch(item.id, { state: 'uploading', progress: 0 })
      try {
        await adminApi.uploadMedia(
          productId,
          item.file,
          { kind: item.kind, title: item.title.trim() || undefined, description: item.description.trim() || undefined },
          (progress) => patch(item.id, { progress }),
        )
        patch(item.id, { state: 'done', progress: 100 })
        uploaded++
      } catch (e) {
        patch(item.id, { state: 'error', error: errorMessage(e) })
      }
    }
    await onUploaded()
    setQueue((q) => {
      q.filter((i) => i.state === 'done').forEach((i) => i.preview && URL.revokeObjectURL(i.preview))
      return q.filter((i) => i.state !== 'done')
    })
    setBusy(false)
    if (uploaded) toast.success(`Загружено файлов: ${uploaded}`)
  }

  const ready = queue.filter((q) => q.state !== 'done' && !q.error).length

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div
        className={clsx('dropzone', drag && 'drag')}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      >
        <UploadIcon size={30} />
        <strong>Перетащите файлы сюда или нажмите, чтобы выбрать</strong>
        <span className="muted small">
          Фото и скрины: JPG, PNG, WEBP, GIF · Документы: PDF, DOC, XLS, TXT · до 25 МБ · Видео: MP4, WEBM, MOV до 200 МБ
        </span>
        <div className="row" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <span className="muted small">Тип по умолчанию:</span>
          <Select<MediaKind>
            aria-label="Тип по умолчанию"
            size="sm"
            style={{ width: 150 }}
            value={defaultKind}
            onChange={setDefaultKind}
            options={[
              { value: 'PHOTO', label: 'Фото' },
              { value: 'SCREENSHOT', label: 'Скрин' },
              { value: 'DOCUMENT', label: 'Документ' },
            ]}
          />
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {queue.length > 0 && (
        <>
          <div className="upload-queue">
            {queue.map((item) => (
              <div key={item.id} className="upload-item">
                {item.preview && isVideoFile(item.file) ? (
                  <video className="preview" src={item.preview} muted preload="metadata" />
                ) : item.preview ? (
                  <img className="preview" src={item.preview} alt="" />
                ) : (
                  <span className="preview">{item.file.name.split('.').pop()?.toUpperCase()}</span>
                )}
                <div className="fields">
                  <div className="row" style={{ gap: 8 }}>
                    <Select<MediaKind>
                      aria-label="Тип файла"
                      style={{ width: 140, flexShrink: 0 }}
                      value={item.kind}
                      disabled={item.state === 'uploading'}
                      onChange={(kind) => patch(item.id, { kind })}
                      options={[
                        { value: 'PHOTO', label: 'Фото' },
                        { value: 'SCREENSHOT', label: 'Скрин' },
                        { value: 'DOCUMENT', label: 'Документ' },
                        { value: 'VIDEO', label: 'Видео' },
                      ]}
                    />
                    <input className="input" placeholder="Заголовок (необязательно)" value={item.title} maxLength={200} disabled={item.state === 'uploading'} onChange={(e) => patch(item.id, { title: e.target.value })} />
                  </div>
                  <input className="input" placeholder="Описание — что изображено / что это за документ" value={item.description} maxLength={5000} disabled={item.state === 'uploading'} onChange={(e) => patch(item.id, { description: e.target.value })} />
                  <span className="muted small">
                    {item.file.name} · {fileSize(item.file.size)}
                  </span>
                  {item.error && <span className="small" style={{ color: 'var(--danger)' }}>{item.error}</span>}
                  {item.state === 'uploading' && (
                    <div className="progress">
                      <span style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
                <button type="button" className="close-btn" onClick={() => removeItem(item.id)} disabled={item.state === 'uploading'} aria-label="Убрать">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={uploadAll} disabled={busy || ready === 0}>
              {busy ? <Spinner /> : `Загрузить (${ready})`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setQueue([])} disabled={busy}>
              Очистить
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function MediaEditModal({ media, productId, onClose, onSaved }: { media: Media; productId: number; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(media.title ?? '')
  const [description, setDescription] = useState(media.description ?? '')
  const [altText, setAltText] = useState(media.altText ?? '')
  const [kind, setKind] = useState<MediaKind>(media.kind)
  const [saving, setSaving] = useState(false)
  const isImage = media.contentType.startsWith('image/')
  const isVideo = media.kind === 'VIDEO'

  const save = async () => {
    setSaving(true)
    try {
      await adminApi.updateMedia(productId, media.id, { title, description, altText, kind: kind !== media.kind ? kind : undefined })
      await onSaved()
      toast.success('Сохранено')
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Файл" onClose={onClose}>
      <div className="stack">
        {isImage && <img src={media.url} alt="" style={{ maxHeight: 260, objectFit: 'contain', borderRadius: 14, background: 'var(--sage-light)' }} />}
        {isVideo && <video src={media.url} controls preload="metadata" style={{ maxHeight: 300, width: '100%', borderRadius: 14, background: '#000' }} />}
        <span className="muted small">
          {media.originalFilename} · {fileSize(media.sizeBytes)}
          {media.width ? ` · ${media.width}×${media.height}` : ''}
        </span>
        {!isVideo && (
          <Field label="Тип" hint={!isImage ? 'Фото и скрином может быть только изображение' : undefined}>
            <Select<MediaKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'PHOTO', label: 'Фото', disabled: !isImage },
                { value: 'SCREENSHOT', label: 'Скрин', disabled: !isImage },
                { value: 'DOCUMENT', label: 'Документ' },
              ]}
            />
          </Field>
        )}
        <Field label="Заголовок">
          <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Описание">
          <textarea className="textarea" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {isImage && (
          <Field label="Alt-текст" hint="Для SEO и незрячих пользователей">
            <input className="input" value={altText} maxLength={255} onChange={(e) => setAltText(e.target.value)} />
          </Field>
        )}
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : 'Сохранить'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  )
}

function MediaGroup({
  kind,
  items,
  productId,
  onChanged,
  onEdit,
}: {
  kind: MediaKind
  items: Media[]
  productId: number
  onChanged: () => Promise<void>
  onEdit: (m: Media) => void
}) {
  const [order, setOrder] = useState(items)
  const [dragId, setDragId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => setOrder(items), [items])

  const run = async (id: number, action: () => Promise<unknown>, success?: string) => {
    setBusyId(id)
    try {
      await action()
      await onChanged()
      if (success) toast.success(success)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const drop = async (targetId: number) => {
    if (dragId == null || dragId === targetId) return
    const next = [...order]
    const from = next.findIndex((m) => m.id === dragId)
    const to = next.findIndex((m) => m.id === targetId)
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setOrder(next)
    try {
      await adminApi.reorderMedia(productId, kind, next.map((m) => m.id))
      await onChanged()
    } catch (e) {
      setOrder(items)
      toast.error(errorMessage(e))
    }
  }

  const titles: Record<MediaKind, string> = { PHOTO: 'Фото', VIDEO: 'Видео', SCREENSHOT: 'Скрины', DOCUMENT: 'Документы' }
  const emptyText: Partial<Record<MediaKind, string>> = {
    PHOTO: 'Нет фото — товар нельзя опубликовать без обложки.',
    VIDEO: 'Загруженных видео нет. Можно загрузить файл здесь или указать ссылку на YouTube выше — в окне товара видео показывается первым.',
  }

  return (
    <div className="media-group">
      <h4>
        {titles[kind]} <span className="badge badge-gray">{items.length}</span>
        {items.length > 1 && <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· перетаскивайте, чтобы изменить порядок</span>}
      </h4>
      {items.length === 0 ? (
        <p className="muted small">{emptyText[kind] ?? 'Пока пусто.'}</p>
      ) : (
        <div className="media-grid">
          {order.map((m) => (
            <div
              key={m.id}
              className={clsx('media-tile', m.cover && 'cover', dragId === m.id && 'dragging', overId === m.id && dragId !== m.id && 'drop-target')}
              draggable
              onDragStart={(e) => {
                setDragId(m.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setOverId(m.id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setOverId(null)
                void drop(m.id)
              }}
            >
              <div className="visual" onClick={() => onEdit(m)}>
                {m.contentType.startsWith('image/') ? (
                  <img src={m.thumbUrl ?? m.url} alt="" loading="lazy" draggable={false} />
                ) : m.kind === 'VIDEO' ? (
                  <video src={`${m.url}#t=0.1`} muted preload="metadata" draggable={false} />
                ) : (
                  <span className="doc-icon">{extensionOf(m)}</span>
                )}
              </div>
              {m.cover && <span className="badge badge-gold cover-flag">Обложка</span>}
              <span className="drag-handle" title="Перетащите">
                <DragIcon size={16} />
              </span>
              <div className="meta">
                <strong>{m.title || m.originalFilename || mediaKindLabel[m.kind]}</strong>
                <span className="muted">{m.description ? m.description.slice(0, 60) : fileSize(m.sizeBytes)}</span>
              </div>
              <div className="tile-actions">
                {kind === 'PHOTO' && !m.cover && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === m.id} onClick={() => run(m.id, () => adminApi.updateMedia(productId, m.id, { cover: true }), 'Обложка обновлена')}>
                    Обложка
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>
                  Изменить
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busyId === m.id}
                  onClick={() => window.confirm('Удалить файл?') && run(m.id, () => adminApi.deleteMedia(productId, m.id), 'Файл удалён')}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MediaManager({ product, onChanged }: { product: AdminProduct | null; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<Media | null>(null)
  const groups = useMemo(() => {
    const media = product?.media ?? []
    const byKind = (kind: MediaKind) => media.filter((m) => m.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder)
    return { PHOTO: byKind('PHOTO'), VIDEO: byKind('VIDEO'), SCREENSHOT: byKind('SCREENSHOT'), DOCUMENT: byKind('DOCUMENT') }
  }, [product?.media])

  if (!product) {
    return (
      <div className="notice">
        Сначала сохраните товар — после этого можно будет загрузить фото, скрины из каталога и документы (сертификаты, инструкции).
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <UploadQueue productId={product.id} onUploaded={onChanged} />
      <div>
        {(['PHOTO', 'VIDEO', 'SCREENSHOT', 'DOCUMENT'] as MediaKind[]).map((kind) => (
          <MediaGroup key={kind} kind={kind} items={groups[kind]} productId={product.id} onChanged={onChanged} onEdit={setEditing} />
        ))}
      </div>
      {editing && <MediaEditModal media={editing} productId={product.id} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </div>
  )
}
