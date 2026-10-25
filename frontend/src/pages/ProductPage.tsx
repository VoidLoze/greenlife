import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import axios from 'axios'
import { catalogApi } from '@/api/endpoints'
import type { Media, ProductDetail } from '@/api/types'
import { BuyBox } from '@/components/BuyBox'
import { Lightbox } from '@/components/Lightbox'
import { MediaCarousel, productSlides, screenshotSlides, type Slide } from '@/components/MediaCarousel'
import { ProductRail } from '@/components/ProductCard'
import { RecentlyViewed } from '@/components/SavedProducts'
import { EmptyState, PageLoader } from '@/components/ui'
import { useT } from '@/i18n'
import { fileSize } from '@/lib/format'
import { useDocumentTitle, useMetaDescription, useNoIndex } from '@/lib/hooks'
import { useFavoritesStore } from '@/store/favorites'

function extensionOf(media: Media) {
  const name = media.originalFilename ?? media.url
  const ext = name.split('.').pop()?.toUpperCase() ?? 'FILE'
  return ext.length > 4 ? 'FILE' : ext
}

type GalleryTab = { id: 'media' | 'shots' | 'docs'; label: string; count: number; slides: Slide[] }

function Gallery({ product }: { product: ProductDetail }) {
  const { t } = useT()
  const tabs = useMemo(() => {
    const media = productSlides(product, false)
    const hasVideo = media.some((s) => s.type === 'video')
    const shots = screenshotSlides(product)
    return (
      [
        { id: 'media', label: hasVideo ? t.videoAndPhotos : t.photos, count: media.length, slides: media },
        { id: 'shots', label: t.screenshots, count: shots.length, slides: shots },
        { id: 'docs', label: t.documents, count: product.documents.length, slides: [] },
      ] as GalleryTab[]
    ).filter((tab) => tab.count > 0)
  }, [product, t])
  const [tabId, setTabId] = useState<GalleryTab['id']>(tabs[0]?.id ?? 'media')
  const [lightbox, setLightbox] = useState<{ items: Media[]; index: number } | null>(null)

  const current = tabs.find((tab) => tab.id === tabId) ?? tabs[0]
  if (!current) return <MediaCarousel slides={[]} alt="" />

  const openLightbox = (media: Media) => {
    const items = current.slides.flatMap((s) => (s.type === 'image' ? [s.media] : []))
    setLightbox({ items, index: Math.max(0, items.indexOf(media)) })
  }

  return (
    <div className="gallery">
      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={clsx('tab', tab.id === current.id && 'active')} onClick={() => setTabId(tab.id)}>
              {tab.label}
              <span className="count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {current.id === 'docs' ? (
        <div className="documents-list">
          {product.documents.map((doc) => (
            <a key={doc.id} className="document-item" href={doc.url} target="_blank" rel="noreferrer">
              {doc.contentType.startsWith('image/') && doc.thumbUrl ? (
                <img src={doc.thumbUrl} alt="" style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover' }} />
              ) : (
                <span className="doc-icon">{extensionOf(doc)}</span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{doc.title ?? doc.originalFilename ?? t.document}</strong>
                {doc.description && <p>{doc.description}</p>}
              </span>
              <span className="muted small nowrap">{fileSize(doc.sizeBytes)}</span>
            </a>
          ))}
        </div>
      ) : (
        <MediaCarousel key={current.id} slides={current.slides} alt={product.card.nameRu} keyboard={!lightbox} onImageClick={openLightbox} />
      )}
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onIndex={(index) => setLightbox({ ...lightbox, index })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

export default function ProductPage() {
  const { slug = '' } = useParams()
  const { t, pick } = useT()
  const product = useQuery({ queryKey: ['product', slug], queryFn: () => catalogApi.product(slug), enabled: !!slug })
  const related = useQuery({ queryKey: ['related', slug], queryFn: () => catalogApi.related(slug), enabled: !!product.data })
  const viewed = useRef<string | null>(null)

  useDocumentTitle(product.data ? pick(product.data.card.nameRu, product.data.card.nameKk) : undefined)
  useMetaDescription(product.data ? pick(product.data.card.summaryRu, product.data.card.summaryKk) : null)
  useNoIndex(product.isError)

  useEffect(() => {
    if (product.data && viewed.current !== slug) {
      viewed.current = slug
      void catalogApi.view(slug)
      useFavoritesStore.getState().addViewed(product.data.card.id)
    }
  }, [product.data, slug])

  if (product.isLoading) return <PageLoader />
  if (product.isError || !product.data) {
    const notFound = axios.isAxiosError(product.error) && product.error.response?.status === 404
    return (
      <EmptyState
        icon="🌿"
        title={notFound ? t.productNotFound : t.productLoadFailed}
        text={notFound ? t.productGoneHint : t.checkConnection}
        action={
          <Link to="/catalog" className="btn btn-primary">
            {t.goToCatalog}
          </Link>
        }
      />
    )
  }

  const p = product.data
  const card = p.card
  const description = pick(p.descriptionRu, p.descriptionKk)
  const usage = pick(p.usageRu, p.usageKk)
  const warnings = pick(p.warningsRu, p.warningsKk)
  const specs: [string, string][] = [
    [t.sku, card.sku],
    ...(card.brand ? [[t.brand, card.brand.name] as [string, string]] : []),
    ...(card.category ? [[t.category, pick(card.category.nameRu, card.category.nameKk)] as [string, string]] : []),
    ...(card.volume ? [[t.volume, card.volume] as [string, string]] : []),
    ...p.attributes.map((a) => [pick(a.nameRu, a.nameKk), pick(a.valueRu, a.valueKk)] as [string, string]),
    ...(p.catalogPage ? [[t.catalogPage, `№ ${p.catalogPage}`] as [string, string]] : []),
  ]

  return (
    <>
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link to="/">{t.home}</Link>
        <span>/</span>
        <Link to="/catalog">{t.catalog}</Link>
        {card.category && (
          <>
            <span>/</span>
            <Link to={`/catalog?category=${card.category.slug}`}>{pick(card.category.nameRu, card.category.nameKk)}</Link>
          </>
        )}
      </nav>

      <div className="product-layout">
        <Gallery key={card.id} product={p} />
        <div className="product-info">
          <div className="row wrap">
            {card.brand && (
              <Link to={`/catalog?brand=${card.brand.slug}`} className="product-brand">
                {card.brand.name}
              </Link>
            )}
            {card.badge && <span className="badge badge-gold">{card.badge}</span>}
            {card.featured && <span className="badge badge-green">★ {t.featured}</span>}
          </div>
          <h1>{pick(card.nameRu, card.nameKk)}</h1>
          <div className="product-meta">
            <span>
              {t.sku}: <b>{card.sku}</b>
            </span>
            {card.volume && (
              <span>
                {t.volume}: <b>{card.volume}</b>
              </span>
            )}
          </div>
          {card.summaryRu && <p style={{ color: 'var(--ink-soft)', lineHeight: 1.7 }}>{pick(card.summaryRu, card.summaryKk)}</p>}
          <BuyBox key={card.id} product={p} />
          {p.benefits.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 12 }}>{t.benefits}</h3>
              <ul className="benefit-list">
                {p.benefits.map((b, i) => (
                  <li key={i}>{pick(b.textRu, b.textKk)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="info-sections">
        {description && (
          <section className="panel info-section wide">
            <h3>{t.description}</h3>
            <p>{description}</p>
          </section>
        )}
        {usage && (
          <section className="panel info-section">
            <h3>{t.usage}</h3>
            <p>{usage}</p>
          </section>
        )}
        <section className="panel info-section">
          <h3>{t.specs}</h3>
          <table className="spec-table">
            <tbody>
              {specs.map(([k, v], i) => (
                <tr key={`${k}-${i}`}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {p.composition && (
          <section className="panel info-section">
            <h3>{t.composition}</h3>
            <p>{p.composition}</p>
          </section>
        )}
        {warnings && (
          <section className="panel info-section warning">
            <h3>{t.warnings}</h3>
            <p>{warnings}</p>
          </section>
        )}
      </div>

      {related.data && related.data.boughtTogether.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t.boughtTogether}</h2>
          </div>
          <ProductRail products={related.data.boughtTogether} />
        </section>
      )}
      {related.data && related.data.similar.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t.similar}</h2>
          </div>
          <ProductRail products={related.data.similar} />
        </section>
      )}
      <RecentlyViewed excludeId={card.id} />
    </>
  )
}
