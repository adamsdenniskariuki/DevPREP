import type { Crumb } from '../nav-model'

/** Where this page sits in the navigation tree. The last crumb is the current page. */
export default function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return <nav aria-label="Breadcrumb" className="breadcrumbs">
    <ol>{crumbs.map((crumb, index) => <li key={`${index}:${crumb.label}`}>
      {index === crumbs.length - 1 ? <span aria-current="page">{crumb.label}</span> : crumb.href ? <a href={crumb.href}>{crumb.label}</a> : <span>{crumb.label}</span>}
    </li>)}</ol>
  </nav>
}
