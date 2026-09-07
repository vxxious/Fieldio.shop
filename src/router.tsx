import { createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { AppLayout } from "./components/AppLayout";

const AccountPage = lazy(() => import("./pages/AccountPage").then((module) => ({ default: module.AccountPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const BrandPage = lazy(() => import("./pages/BrandPage").then((module) => ({ default: module.BrandPage })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));
const CollectionPage = lazy(() => import("./pages/CollectionPage").then((module) => ({ default: module.CollectionPage })));
const ContentPage = lazy(() => import("./pages/ContentPage").then((module) => ({ default: module.ContentPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const ProductPage = lazy(() => import("./pages/ProductPage").then((module) => ({ default: module.ProductPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })));
const ServicePage = lazy(() => import("./pages/ServicePage").then((module) => ({ default: module.ServicePage })));
const WishlistPage = lazy(() => import("./pages/WishlistPage").then((module) => ({ default: module.WishlistPage })));

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/collections", element: <CollectionPage /> },
      { path: "/collections/:slug", element: <CollectionPage /> },
      { path: "/products/:slug", element: <ProductPage /> },
      { path: "/brands/:slug", element: <BrandPage /> },
      { path: "/brands", element: <BrandPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/wishlist", element: <WishlistPage /> },
      { path: "/checkout", element: <CheckoutPage /> },
      { path: "/personal-shopping", element: <ServicePage /> },
      { path: "/wholesale", element: <ServicePage /> },
      { path: "/contact", element: <ServicePage /> },
      { path: "/account", element: <AccountPage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "/about", element: <ContentPage /> },
      { path: "/shipping", element: <ContentPage /> },
      { path: "/returns", element: <ContentPage /> },
      { path: "/privacy", element: <ContentPage /> },
      { path: "/terms", element: <ContentPage /> },
      { path: "/cookies", element: <ContentPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
