import { Link } from 'react-router'
import { EmptyState } from '@/components/ui'
import { useT } from '@/i18n'
import { useDocumentTitle, useNoIndex } from '@/lib/hooks'

export default function NotFoundPage() {
  const { t } = useT()
  useDocumentTitle(t.notFound)
  useNoIndex()
  return (
    <EmptyState
      icon="404"
      title={t.notFound}
      text={t.notFoundHint}
      action={
        <div className="row">
          <Link to="/" className="btn btn-ghost">
            {t.home}
          </Link>
          <Link to="/catalog" className="btn btn-primary">
            {t.goToCatalog}
          </Link>
        </div>
      }
    />
  )
}
