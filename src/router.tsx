import { createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { AppLayout } from "./components/AppLayout";
import { AccountGate } from "./components/AccountGate";
import { MfaGate } from "./components/MfaSecurity";
import { RouteErrorPage } from "./components/RouteErrorPage";

const AccountPage = lazy(() => import("./pages/AccountPage").then((module) => ({ default: module.AccountPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AdminInvitePage = lazy(() => import("./pages/AdminInvitePage").then((module) => ({ default: module.AdminInvitePage })));
const BrandPage = lazy(() => import("./pages/BrandPage").then((module) => ({ default: module.BrandPage })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));
const CollectionPage = lazy(() => import("./pages/CollectionPage").then((module) => ({ default: module.CollectionPage })));
const ContentPage = lazy(() => import("./pages/ContentPage").then((module) => ({ default: module.ContentPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const ProductPage = lazy(() => import("./pages/ProductPage").then((module) => ({ default: module.ProductPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })));
const SellerPage = lazy(() => import("./pages/SellerPage").then((module) => ({ default: module.SellerPage })));
const StorePage = lazy(() => import("./pages/StorePage").then((module) => ({ default: module.StorePage })));
const ServicePage = lazy(() => import("./pages/ServicePage").then((module) => ({ default: module.ServicePage })));
const WishlistPage = lazy(() => import("./pages/WishlistPage").then((module) => ({ default: module.WishlistPage })));

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/collections", element: <CollectionPage /> },
      { path: "/collections/:slug", element: <CollectionPage /> },
      { path: "/products/:slug", element: <ProductPage /> },
      { path: "/brands/:slug", element: <BrandPage /> },
      { path: "/brands", element: <BrandPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/wishlist", element: <AccountGate><WishlistPage /></AccountGate> },
      { path: "/checkout", element: <AccountGate><MfaGate><CheckoutPage /></MfaGate></AccountGate> },
      { path: "/personal-shopping", element: <ServicePage /> },
      { path: "/wholesale", element: <ServicePage /> },
      { path: "/contact", element: <ServicePage /> },
      { path: "/account", element: <MfaGate><AccountPage /></MfaGate> },
      { path: "/sell", element: <MfaGate><SellerPage /></MfaGate> },
      { path: "/stores/:slug", element: <StorePage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "/admin/invite", element: <AdminInvitePage /> },
      { path: "/about", element: <ContentPage /> },
      { path: "/promise", element: <ContentPage /> },
      { path: "/how-it-works", element: <ContentPage /> },
      { path: "/shipping", element: <ContentPage /> },
      { path: "/returns", element: <ContentPage /> },
      { path: "/privacy", element: <ContentPage /> },
      { path: "/terms", element: <ContentPage /> },
      { path: "/cookies", element: <ContentPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
