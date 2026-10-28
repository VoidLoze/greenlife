import { Link } from 'react-router'
import type { Category, ProductCard } from '@/api/types'
import { CARD_BENEFITS } from '@/content/promo'
import { useT } from '@/i18n'
import { categoryIcon } from '@/lib/categoryIcon'
import { ProductRail } from './ProductCard'

/** Phone-only row of round category shortcuts, scrolled sideways like stories in a messenger. */
export function CategoryStories({ categories }: { categories: Category[] }) {
  const { t, pick } = useT()
  if (!categories.length) return null
  return (
    <nav className="stories" aria-label={t.categories}>
      {categories.map((c) => (
        <Link key={c.slug} to={`/catalog?category=${c.slug}`} className="story">
          <span className="story-ring">
            {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" /> : <span className="story-icon">{categoryIcon(c.icon)}</span>}
          </span>
          <span className="story-name">{pick(c.nameRu, c.nameKk)}</span>
        </Link>
      ))}
    </nav>
  )
}

/** Phone-only banner that sells the discount card with its two money perks. */
export function CardPromo() {
  const { t } = useT()
  const [discount, cashback] = CARD_BENEFITS.main
  const [before, after] = discount.title.split(discount.accent ?? '')
  return (
    <Link to="/partner" className="card-promo">
      <span className="card-promo-body">
        <span className="card-promo-title">
          {before.trim()} <b>{discount.accent}</b>
        </span>
        <span className="card-promo-sub">{after?.trim()}</span>
        <span className="card-promo-extra">{cashback.title}</span>
        <span className="card-promo-cta">{t.giftCardCta} →</span>
      </span>
      <img src="/cards/IMG_5334.jpeg" alt="" className="card-promo-img" loading="lazy" />
    </Link>
  )
}

/** Phone version of a home rail: compact cards scrolled sideways, several offers on one screen. */
export function MobileSection({ title, link, products }: { title: string; link: string; products: ProductCard[] }) {
  const { t } = useT()
  if (!products.length) return null
  return (
    <section className="m-section">
      <div className="section-head">
        <h2>{title}</h2>
        <Link to={link} className="m-see-all">
          {t.seeAll} →
        </Link>
      </div>
      <ProductRail products={products} />
    </section>
  )
}
