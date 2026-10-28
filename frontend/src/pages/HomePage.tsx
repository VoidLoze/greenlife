import { useEffect } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import type { ProductCard } from '@/api/types'
import { ProductGrid, ProductRail } from '@/components/ProductCard'
import { GiftPick } from '@/components/GiftPick'
import { RecentlyViewed } from '@/components/SavedProducts'
import { CardGiftBanner, DeliveryNote, Marquee } from '@/components/Promo'
import { MARQUEE_SENTENCES, PARTNERSHIP_FORMULA } from '@/content/promo'
import { HomeReels } from '@/components/HomeReels'
import { CardPromo, CategoryStories, MobileSection } from '@/components/MobileHome'
import { useT } from '@/i18n'
import { categoryIcon } from '@/lib/categoryIcon'
import { useIsPhone, useSettings } from '@/lib/hooks'

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
  const phone = useIsPhone()
  useEffect(() => {
    document.title = 'Greenleaf family — Born for Beauty'
  }, [])

  const discount = settings?.partnerDiscountPercent || 50

  if (phone) {
    return (
      <div className="m-home">
        {data && <CategoryStories categories={data.categories} />}
        <HomeReels
          overlay={
            <>
              <h1 className="m-hero-title">{t.heroTitle}</h1>
              <Link to="/partner" className="m-hero-lead">
                {t.heroText}
              </Link>
            </>
          }
        />
        <CardPromo />
        {isLoading && <ProductGrid loading skeletons={2} />}
        {data && <MobileSection title={t.bestsellers} link="/catalog?sort=popular" products={data.bestsellers} />}
        <CardGiftBanner className="wide" />
        {data && <MobileSection title={t.featured} link="/catalog?featured=true" products={data.featured} />}
        <DeliveryNote />
        {data && <MobileSection title={t.newest} link="/catalog?sort=newest" products={data.newest} />}
        <GiftPick />
        <RecentlyViewed />
      </div>
    )
  }

  return (
    <>
      <Marquee sentences={MARQUEE_SENTENCES} to="/partner" />

      <section className="home-hero">
        <div className="home-logo">
          <img src="/logo-full.webp" alt="Greenleaf family — Born for Beauty" width={1600} height={266} fetchPriority="high" />
        </div>
        <h1 className="home-slogan">{t.heroTitle}</h1>
        <Link to="/partner" className="home-lead">
          {t.heroText}
        </Link>

        <HomeReels />

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
              <span className="partner-formula">
                <span className="formula-label">
                  Партнёрство =
                </span>
                <span className="formula-part">
                  <b>{discount}%</b>
                  <span>
                    {PARTNERSHIP_FORMULA.discount}
                    <em>{PARTNERSHIP_FORMULA.discountNote}</em>
                  </span>
                </span>
                <span className="formula-plus">
                  +
                </span>
                <span className="formula-part gift">
                  <b>🎁</b>
                  <span>
                    {PARTNERSHIP_FORMULA.gift}
                    <em>{PARTNERSHIP_FORMULA.giftNote}</em>
                  </span>
                </span>
              </span>
            </span>
            <span className="home-entry-cta">{t.morePartner} →</span>
          </Link>
        </div>

        <DeliveryNote />
        <GiftPick />
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
          <CardGiftBanner className="wide" />
        </section>
      )}

      <RecentlyViewed />

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
