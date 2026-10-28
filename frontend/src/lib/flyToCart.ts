function visible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement) || getComputedStyle(el).display === 'none') return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

/** The product photo nearest to the clicked button: the card's own, or the open carousel slide. */
function sourceImage(from: Element): HTMLImageElement | null {
  const card = from.closest('.product-card, .gift-pick')
  if (card) return card.querySelector('.product-visual img, .gift-pick-visual img')
  for (let el = from.parentElement; el; el = el.parentElement) {
    const img = el.querySelector<HTMLImageElement>('.carousel-slide[aria-hidden="false"] img, .carousel-slide img')
    if (img) return img
  }
  return null
}

/** A short buzz on phones and a photo flying into the cart button — after the cart has been updated. */
export function flyToCart(from: Element) {
  navigator.vibrate?.(15)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const img = sourceImage(from)
  // The cart badge only appears after the first item lands, so wait for that render.
  requestAnimationFrame(() => {
    const target = ['.tab-cart', '.m-buy-cart', '.cart-btn'].map((s) => document.querySelector(s)).find(visible)
    if (!img || !target || !visible(img)) return
    const a = img.getBoundingClientRect()
    const b = target.getBoundingClientRect()
    const size = Math.min(120, a.width, a.height)
    const ghost = img.cloneNode() as HTMLImageElement
    ghost.removeAttribute('loading')
    ghost.className = 'fly-ghost'
    Object.assign(ghost.style, {
      left: `${a.left + (a.width - size) / 2}px`,
      top: `${a.top + (a.height - size) / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
    })
    document.body.appendChild(ghost)
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    const animation = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 60}px) scale(0.6)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0.3 },
      ],
      { duration: 650, easing: 'cubic-bezier(.5,0,.75,.4)' },
    )
    const done = () => {
      ghost.remove()
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300 })
    }
    animation.onfinish = done
    animation.oncancel = () => ghost.remove()
  })
}
