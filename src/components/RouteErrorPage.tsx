import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { createWhatsAppUrl } from "../lib/whatsapp";

export function RouteErrorPage() {
  const error = useRouteError();
  const unavailable = isRouteErrorResponse(error) && error.status === 404;
  const title = unavailable ? "This page could not be found." : "Fieldio could not open this page.";

  return (
    <main id="main-content" className="recovery-page" tabIndex={-1}>
      <p className="recovery-brand">Fieldio</p>
      <h1>{title}</h1>
      <p>Your bag is safe on this device. Retry the page, return to the edit, or contact Fieldio if the problem continues.</p>
      <div className="recovery-actions">
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>Retry page</button>
        <Link className="secondary-button" to="/">Return home</Link>
        <a className="text-link" href={createWhatsAppUrl("Hello Fieldio, I need help accessing the website.")} target="_blank" rel="noreferrer">Contact Fieldio</a>
      </div>
    </main>
  );
}
