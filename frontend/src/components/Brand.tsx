/** The official Greenleaf family logo; it is green on transparent, so it sits on a white plate on the dark theme. */
export function BrandLogo({ subtitle }: { subtitle?: string }) {
  return (
    <>
      <span className="brand-plate">
        <img
          src="/logo-full-sm.webp"
          srcSet="/logo-full-sm.webp 640w, /logo-full.webp 1600w"
          sizes="220px"
          alt="Greenleaf family — Born for Beauty"
          width={640}
          height={106}
        />
      </span>
      {subtitle && <small className="brand-sub">{subtitle}</small>}
    </>
  )
}
