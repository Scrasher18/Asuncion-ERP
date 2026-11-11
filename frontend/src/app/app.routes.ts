import { Routes } from '@angular/router';
import { authGuard, catalogGuard, roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Catálogo de Repuestos | Autopartes Asunción',
    canActivate: [catalogGuard],
    loadComponent: () =>
      import('./features/catalog/catalog.page').then((m) => m.CatalogPageComponent),
  },
  {
    path: 'ofertas',
    title: 'Ofertas y Combos | Autopartes Asunción',
    canActivate: [catalogGuard],
    loadComponent: () =>
      import('./features/offers/offers.page').then((m) => m.OffersPageComponent),
  },
  {
    path: 'login',
    title: 'Iniciar sesión | Autopartes Asunción',
    loadComponent: () =>
      import('./features/auth/login.page').then((m) => m.LoginPageComponent),
  },
  {
    path: 'part/:id',
    title: 'Detalle del repuesto | Autopartes Asunción',
    canActivate: [catalogGuard],
    loadComponent: () =>
      import('./features/catalog/part-detail.page').then((m) => m.PartDetailPageComponent),
  },
  {
    path: 'checkout',
    title: 'Finalizar compra | Autopartes Asunción',
    canActivate: [catalogGuard, authGuard],
    loadComponent: () =>
      import('./features/checkout/checkout.page').then((m) => m.CheckoutPageComponent),
  },
  {
    path: 'track',
    title: 'Seguimiento de pedido | Autopartes Asunción',
    canActivate: [catalogGuard],
    loadComponent: () =>
      import('./features/orders/track-order.page').then((m) => m.TrackOrderPageComponent),
  },
  {
    path: 'my-orders',
    title: 'Mis pedidos | Autopartes Asunción',
    canActivate: [authGuard, roleGuard(['CLIENTE', 'ADMIN', 'VENDEDOR'])],
    loadComponent: () =>
      import('./features/orders/my-orders.page').then((m) => m.MyOrdersPageComponent),
  },
  {
    path: 'admin',
    title: 'Administración | Repuestos Asunción',
    canActivate: [roleGuard(['ADMIN', 'VENDEDOR'])],
    loadComponent: () =>
      import('./features/admin/admin-erp.page').then((m) => m.AdminErpPageComponent),
  },
  {
    path: 'pos',
    title: 'Punto de Venta (Caja) | Repuestos Asunción',
    canActivate: [roleGuard(['ADMIN', 'VENDEDOR'])],
    loadComponent: () =>
      import('./features/pos/pos.page').then((m) => m.PosPageComponent),
  },
  {
    path: 'delivery',
    title: 'Reparto y entregas | Repuestos Asunción',
    canActivate: [roleGuard(['ADMIN', 'MOTORIZADO'])],
    loadComponent: () =>
      import('./features/delivery/delivery.page').then((m) => m.DeliveryPageComponent),
  },
  {
    path: 'terminos-y-condiciones',
    title: 'Términos y Condiciones | Repuestos Asunción',
    loadComponent: () =>
      import('./features/legal/terms.page').then((m) => m.TermsPageComponent),
  },
  {
    path: 'politica-devoluciones',
    title: 'Políticas de Cambios y Devoluciones | Repuestos Asunción',
    loadComponent: () =>
      import('./features/legal/refund-policy.page').then((m) => m.RefundPolicyPageComponent),
  },
  {
    path: 'libro-de-reclamaciones',
    title: 'Libro de Reclamaciones Virtual | Repuestos Asunción',
    loadComponent: () =>
      import('./features/legal/complaints-book.page').then((m) => m.ComplaintsBookPageComponent),
  },
  {
    path: 'catalog',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'libro-reclamaciones',
    redirectTo: 'libro-de-reclamaciones',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
