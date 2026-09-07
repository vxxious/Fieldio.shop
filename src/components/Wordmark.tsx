import { Link } from "react-router-dom";

export function Wordmark() {
  return (
    <Link to="/" className="fieldio-wordmark" aria-label="Fieldio home">
      <img className="fieldio-monogram" src="/brand/fieldio-monogram.webp" width="34" height="44" alt="" />
      <span>Fieldio</span>
    </Link>
  );
}
