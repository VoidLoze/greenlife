import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import type { ProductCard } from '@/api/types'
import { ProductGrid, ProductRail } from '@/components/ProductCard'
import { VideoPlayer } from '@/components/VideoPlayer'
import { useT } from '@/i18n'
import { categoryIcon } from '@/lib/categoryIcon'
import { useDocumentTitle, useSettings } from '@/lib/hooks'

function Section({ eyebrow, title, link, products }: { eyebrow: string; title: string; link: string; products: ProductCard[] }) {
  const { t } = useT()
  if (!products.length) return null
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <Link to={link} className="btn btn-ghost btn-sm">
          {t.seeAll} →
        </Link>
      </div>
      <ProductRail products={products} />
    </section>
  )
}

export default function HomePage() {
  const { t, pick } = useT()
  const { data, isLoading } = useQuery({ queryKey: ['home'], queryFn: catalogApi.home })
  const { data: settings } = useSettings()
  useDocumentTitle('Главная')

  const discount = settings?.partnerDiscountPercent

  return (
    <>
      <section className="home-hero">
        <div className="home-logo">
          <img src="/logo-full.webp" alt="Greenleaf family — Born for Beauty" width={1600} height={266} fetchPriority="high" />
        </div>
        <h1 className="home-slogan">{t.heroTitle}</h1>
        <p className="home-lead">{t.heroText}</p>

        {settings?.companyVideoUrl && (
          <figure className="home-video">
            <VideoPlayer url={settings.companyVideoUrl} title={settings.companyVideoTitle} showTitle={false} />
            <figcaption>
              <span className="eyebrow">{t.companyVideo}</span>
              {settings.companyVideoTitle && <strong>{settings.companyVideoTitle}</strong>}
            </figcaption>
          </figure>
        )}

        <div className="home-entries">
          <Link to="/catalog" className="home-entry">
            <span className="home-entry-icon" aria-hidden="true">
              🌿
            </span>
            <span className="home-entry-body">
              <strong>{t.catalog}</strong>
              <small>
                {data
                  ? `${data.productCount} ${t.productsCount} · ${data.categories.length} ${t.categoriesCount}`
                  : t.allProducts}
              </small>
            </span>
            <span className="home-entry-cta">{t.viewCatalog} →</span>
          </Link>
          <Link to="/partner" className="home-entry partner">
            <span className="home-entry-icon" aria-hidden="true">
              ✦
            </span>
            <span className="home-entry-body">
              <strong>{t.partner}</strong>
              <small>{t.partnerTileText}</small>
              {discount ? (
                <em className="home-entry-badge">
                  {t.partnerDiscountLine} {discount}%
                </em>
              ) : null}
            </span>
            <span className="home-entry-cta">{t.morePartner} →</span>
          </Link>
        </div>
      </section>

      {data && data.categories.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <span className="eyebrow">{t.catalog}</span>
              <h2>{t.categories}</h2>
            </div>
          </div>
          <div className="category-grid">
            {data.categories.map((c) => (
              <Link key={c.slug} to={`/catalog?category=${c.slug}`} className="category-tile">
                <span className="icon">{categoryIcon(c.icon)}</span>
                <span>
                  <strong>{pick(c.nameRu, c.nameKk)}</strong>
                  <small style={{ display: 'block' }}>
                    {c.productCount} {t.products.toLowerCase()}
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <section className="section">
          <ProductGrid loading skeletons={4} />
        </section>
      ) : (
        data && (
          <>
            <Section eyebrow="Greenleaf" title={t.featured} link="/catalog?featured=true" products={data.featured} />
            <Section eyebrow="Top" title={t.bestsellers} link="/catalog?sort=popular" products={data.bestsellers} />
            <Section eyebrow="New" title={t.newest} link="/catalog?sort=newest" products={data.newest} />
          </>
        )
      )}
    </>
  )
}
