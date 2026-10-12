import { Link, useLocation } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { contentPages } from "../data/content-pages";


export function ContentPage() {
  const { pathname } = useLocation();
  const page = contentPages[pathname] ?? contentPages["/about"]!;
  usePageMeta({ title: pathname === "/about" ? "About Fieldio | Designer Fashion Marketplace" : `${page.title} | Fieldio`, description: page.intro, canonical: `https://fieldio.shop${pathname}` });
  return <article className="content-page"><header><h1>{page.title}</h1><p>{page.intro}</p></header>{page.updated && <time className="policy-date" dateTime={page.updated.dateTime}>{page.updated.label}</time>}<div className="content-sections">{page.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>{page.updated && <p className="policy-note">This launch-stage policy copy should be reviewed by Fieldio’s legal adviser before a final effective date is published.</p>}{pathname === "/returns" ? <a href="mailto:returns@fieldio.shop" className="text-link">Email returns@fieldio.shop</a> : <Link to="/contact" className="text-link">Contact Fieldio</Link>}</article>;
}
