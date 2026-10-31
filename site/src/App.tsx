import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import { FoodDetail, MenuPage } from './pages/Menu'
import { About, Branches, Contact, Gallery, NotFound } from './pages/Info'
import { Privacy, Refunds, Terms } from './pages/Legal'
import { Cart, Checkout } from './pages/CartCheckout'
import { MockPayment, OrderPage } from './pages/Payment'
import FloatingCartButton from './components/FloatingCartButton'

const AdminRoot = lazy(() => import('./admin/Shell'))

export default function App() {
  return (
    <>
      <Routes>
      <Route path="admin/*" element={<Suspense fallback={null}><AdminRoot /></Suspense>} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="menu/:slug" element={<FoodDetail />} />
        <Route path="about" element={<About />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="branches" element={<Branches />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="pay/mock" element={<MockPayment />} />
        <Route path="order" element={<OrderPage />} />
        <Route path="order/:code" element={<OrderPage />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="refunds" element={<Refunds />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
      <FloatingCartButton />
    </>
  )
}
