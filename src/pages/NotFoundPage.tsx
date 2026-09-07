import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";

export function NotFoundPage() {
  usePageMeta({
    title: "Page not found | Fieldio",
    description: "Return to the Fieldio fashion edit.",
    canonical: "https://fieldio.shop/404"
  });

  return (
    <section className="not-found">
      <h1>This page is not in the edit.</h1>
      <p>The piece or page may have moved. Return to the latest Fieldio selection.</p>
      <Link to="/collections" className="primary-button">Explore the edit</Link>
    </section>
  );
}
