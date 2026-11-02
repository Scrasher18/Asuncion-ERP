import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoleName } from '../models/api.models';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (authService.isAuthenticated()) {
    return true;
  }

  toast.warning('Inicio de sesión requerido', 'Ingresa a tu cuenta para continuar.');
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export function roleGuard(allowedRoles: RoleName[]): CanActivateFn {
  return (_route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);

    if (!authService.isAuthenticated()) {
      toast.warning(
        'Acceso restringido',
        'Inicia sesión con una cuenta autorizada para ingresar a esta sección.'
      );
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }

    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    toast.error(
      'Permisos insuficientes',
      'Tu perfil actual no cuenta con permisos para acceder a esta sección.'
    );
    return router.createUrlTree([authService.defaultHomeForUser()]);
  };
}

export const catalogGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    if (authService.isDeliveryDriverOnly()) {
      return router.createUrlTree(['/delivery']);
    }
  }
  return true;
};
