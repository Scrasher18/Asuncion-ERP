import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RegisterRequest } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { ToastService } from '../../core/services/toast.service';
import { RecaptchaV3Service } from '../../core/services/recaptcha-v3.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-[calc(100vh-4rem)] bg-[#F8F9FA] pt-6 sm:pt-8 pb-24 lg:pb-14 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-md space-y-4">
        <!-- Automotive Real Photography Banner -->
        <div class="relative rounded-2xl overflow-hidden h-32 sm:h-36 shadow-sm border border-gray-200">
          <img
            src="/images/banners/hero-workshop.jpg"
            alt="Asunción Repuestos Automotrices"
            class="w-full h-full object-cover filter brightness-50 contrast-125"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-gray-950/95 via-gray-950/50 to-transparent flex flex-col justify-end p-4 text-white">
            <div class="flex items-center gap-2 mb-1">
              <svg class="h-4 w-4 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="17" cy="17" r="2" />
              </svg>
              <span class="text-xs font-semibold text-orange-300 uppercase tracking-wider">Repuestos Automotrices Asunción</span>
            </div>
            <h1 class="text-lg sm:text-xl font-bold text-white tracking-tight">
              {{ mode() === 'login' ? 'Inicia sesión en tu cuenta' : mode() === 'register' ? 'Crea tu cuenta de cliente' : 'Recuperar acceso' }}
            </h1>
            <p class="text-[11px] text-gray-300">
              Compra repuestos, consulta comprobantes y haz seguimiento en vivo.
            </p>
          </div>
        </div>

        

        <!-- Primary Login / Register Card -->
        <div class="rounded-2xl border border-gray-200/90 bg-white p-6 sm:p-7 shadow-xs relative overflow-hidden">
          <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>

          <!-- Mode Tabs (visible on login & register) -->
          @if (mode() !== 'forgot') {
            <div class="grid grid-cols-2 rounded-xl bg-gray-100 p-1 mb-6">
              <button
                type="button"
                (click)="mode.set('login'); errorMessage.set('')"
                [class]="
                  mode() === 'login'
                    ? 'bg-white text-gray-900 font-bold shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800 font-medium'
                "
                class="rounded-lg py-2 text-xs transition cursor-pointer"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                (click)="mode.set('register'); errorMessage.set('')"
                [class]="
                  mode() === 'register'
                    ? 'bg-white text-gray-900 font-bold shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800 font-medium'
                "
                class="rounded-lg py-2 text-xs transition cursor-pointer"
              >
                Crear cuenta
              </button>
            </div>
          }

          @if (mode() === 'login') {
            <form (ngSubmit)="submitLogin()" class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  [(ngModel)]="loginEmail"
                  required
                  placeholder="nombre@correo.pe"
                  class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1.5">
                  Contraseña
                </label>
                <div class="relative">
                  <input
                    [type]="showLoginPassword() ? 'text' : 'password'"
                    name="password"
                    [(ngModel)]="loginPassword"
                    required
                    placeholder="Ingresa tu contraseña"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3.5 pr-11 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    (click)="showLoginPassword.set(!showLoginPassword())"
                    class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 transition"
                    [attr.aria-label]="showLoginPassword() ? 'Ocultar contraseña' : 'Ver contraseña'"
                  >
                    @if (showLoginPassword()) {
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    } @else {
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  </button>
                </div>

                <div class="flex items-center justify-between text-xs pt-1.5">
                  <span class="text-gray-400">¿Problemas para acceder?</span>
                  <button
                    type="button"
                    (click)="openForgotPassword()"
                    class="font-semibold text-orange-600 hover:text-orange-700 hover:underline transition"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              @if (errorMessage()) {
                <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {{ errorMessage() }}
                </div>
              }

              <button
                type="submit"
                [disabled]="isLoading()"
                class="w-full min-h-[44px] rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
              >
                {{ isLoading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}
              </button>
            </form>
          } @else if (mode() === 'forgot') {
            <div class="space-y-4">
              <div class="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  (click)="mode.set('login'); errorMessage.set(''); resetSuccessMessage.set('')"
                  class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-orange-600 transition"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  <span>Volver a iniciar sesión</span>
                </button>
              </div>

              @if (resetSuccessMessage()) {
                <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div class="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <svg class="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>¡Contraseña actualizada con éxito!</span>
                  </div>
                  <p class="text-xs text-emerald-700 leading-relaxed">
                    {{ resetSuccessMessage() }}
                  </p>
                  <button
                    type="button"
                    (click)="mode.set('login'); resetSuccessMessage.set('')"
                    class="w-full min-h-[40px] rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Iniciar sesión ahora
                  </button>
                </div>
              } @else if (forgotStep() === 'request') {
                <form (ngSubmit)="submitForgotPasswordRequest()" class="space-y-4">
                  <div class="space-y-1">
                    <h2 class="text-sm font-bold text-gray-900">Recuperación de contraseña</h2>
                    <p class="text-xs text-gray-500">
                      Ingresa el correo registrado en tu cuenta para enviarte un código o validar tu identidad al instante.
                    </p>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      name="forgotEmail"
                      [(ngModel)]="forgotEmail"
                      (ngModelChange)="onFormChange()"
                      required
                      placeholder="nombre@correo.pe"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                  </div>

                  @if (errorMessage()) {
                    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {{ errorMessage() }}
                    </div>
                  }

                  <button
                    type="submit"
                    [disabled]="isLoading() || !forgotEmail.trim()"
                    class="w-full min-h-[44px] rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {{ isLoading() ? 'Verificando cuenta...' : 'Continuar' }}
                  </button>
                </form>
              } @else if (recoveryChannel() === 'CONTACT_ADMIN') {
                <div class="space-y-4">
                  <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                    <div class="text-xs font-bold text-amber-900">Validación asistida requerida</div>
                    <p class="text-xs text-amber-800 leading-relaxed">
                      {{ recoveryNotice() }}
                    </p>
                  </div>

                  <button
                    type="button"
                    (click)="forgotStep.set('request'); errorMessage.set('')"
                    class="w-full min-h-[40px] rounded-xl border border-orange-200 bg-orange-50 text-xs text-orange-700 hover:bg-orange-100 font-semibold py-2 transition cursor-pointer"
                  >
                    Probar con otro correo electrónico
                  </button>
                </div>
              } @else {
                <form (ngSubmit)="submitResetPasswordConfirm()" class="space-y-4">
                  <div class="space-y-1">
                    <div class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700">
                      <span>
                        {{ recoveryChannel() === 'EMAIL' ? 'Paso 2: Código por correo' : 'Paso 2: Verificación de identidad' }}
                      </span>
                    </div>
                    <h2 class="text-sm font-bold text-gray-900">
                      {{ recoveryChannel() === 'EMAIL' ? 'Ingresa el código y tu nueva contraseña' : 'Confirma tus datos registrados y asigna tu nueva clave' }}
                    </h2>
                    <p class="text-xs text-gray-500">
                      Cuenta: <strong class="text-gray-800">{{ forgotEmail }}</strong>
                    </p>
                    @if (recoveryNotice()) {
                      <div class="rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-[11px] text-blue-900 leading-relaxed">
                        {{ recoveryNotice() }}
                      </div>
                    }
                  </div>

                  @if (recoveryChannel() === 'EMAIL') {
                    <div>
                      <div class="flex items-center justify-between gap-2 mb-1.5">
                        <label class="block text-xs font-medium text-gray-700">
                          Código de 6 dígitos
                        </label>
                        @if (recoveryCanVerifyIdentity()) {
                          <button
                            type="button"
                            (click)="recoveryChannel.set('IDENTITY_VERIFICATION'); errorMessage.set('')"
                            class="text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                          >
                            Verificar con DNI/Celular
                          </button>
                        }
                      </div>
                      <input
                        type="text"
                        name="forgotCode"
                        [(ngModel)]="forgotCode"
                        (ngModelChange)="onFormChange()"
                        maxlength="6"
                        required
                        placeholder="123456"
                        class="w-full min-h-[44px] rounded-xl border border-orange-200 bg-white px-3.5 py-2.5 text-center font-mono text-xl font-bold tracking-widest text-orange-700 placeholder-gray-300 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                      />
                    </div>
                  } @else {
                    <div class="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                      @if (recoveryRequiresDocument()) {
                        <div>
                          <div class="flex items-center justify-between gap-2 mb-1">
                            <label class="block text-xs font-medium text-gray-700">
                              DNI / RUC registrado en tu cuenta *
                            </label>
                            @if (recoveryMaskedDocument()) {
                              <span class="font-mono text-[10px] text-gray-500">{{ recoveryMaskedDocument() }}</span>
                            }
                          </div>
                          <input
                            type="text"
                            name="forgotDocument"
                            [(ngModel)]="forgotDocument"
                            (ngModelChange)="onFormChange()"
                            maxlength="15"
                            required
                            placeholder="Ingresa tu DNI (8 dígitos) o RUC (11)"
                            class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                          />
                        </div>
                      }

                      @if (recoveryRequiresPhone()) {
                        <div>
                          <div class="flex items-center justify-between gap-2 mb-1">
                            <label class="block text-xs font-medium text-gray-700">
                              Número de celular registrado *
                            </label>
                            @if (recoveryMaskedPhone()) {
                              <span class="font-mono text-[10px] text-gray-500">{{ recoveryMaskedPhone() }}</span>
                            }
                          </div>
                          <input
                            type="tel"
                            name="forgotPhone"
                            [(ngModel)]="forgotPhone"
                            (ngModelChange)="onFormChange()"
                            maxlength="15"
                            required
                            placeholder="Ej: 987654321"
                            class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                          />
                        </div>
                      }
                    </div>
                  }

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Nueva contraseña (mínimo 8 caracteres y 1 carácter especial)
                    </label>
                    <div class="relative">
                      <input
                        [type]="showResetPassword() ? 'text' : 'password'"
                        name="newResetPassword"
                        [(ngModel)]="newResetPassword"
                        (ngModelChange)="onFormChange()"
                        required
                        placeholder="Nueva contraseña segura (ej: Repuesto#2026)"
                        class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3.5 pr-11 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        (click)="showResetPassword.set(!showResetPassword())"
                        class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 transition"
                      >
                        @if (showResetPassword()) {
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        } @else {
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        }
                      </button>
                    </div>
                    <!-- Live Password Complexity Checklist for Reset -->
                    <div class="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                      <span
                        class="flex items-center justify-center gap-1 rounded py-1 border transition"
                        [class]="isResetPassLengthValid() ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'"
                      >
                        <span>{{ isResetPassLengthValid() ? '✓' : '○' }}</span>
                        <span>8+ carac.</span>
                      </span>
                      <span
                        class="flex items-center justify-center gap-1 rounded py-1 border transition"
                        [class]="isResetPassNumberValid() ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'"
                      >
                        <span>{{ isResetPassNumberValid() ? '✓' : '○' }}</span>
                        <span>Número</span>
                      </span>
                      <span
                        class="flex items-center justify-center gap-1 rounded py-1 border transition"
                        [class]="isResetPassSpecialValid() ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'"
                      >
                        <span>{{ isResetPassSpecialValid() ? '✓' : '○' }}</span>
                        <span>Especial</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Confirmar nueva contraseña
                    </label>
                    <input
                      [type]="showResetPassword() ? 'text' : 'password'"
                      name="confirmResetPassword"
                      [(ngModel)]="confirmResetPassword"
                      (ngModelChange)="onFormChange()"
                      required
                      placeholder="Repite tu nueva contraseña"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                  </div>

                  @if (errorMessage()) {
                    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {{ errorMessage() }}
                    </div>
                  }

                  <button
                    type="submit"
                    [disabled]="isLoading() || !isResetFormReady()"
                    class="w-full min-h-[44px] rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {{ isLoading() ? 'Guardando contraseña...' : 'Guardar y cambiar contraseña' }}
                  </button>

                  <div class="text-center pt-1 text-xs">
                    <button
                      type="button"
                      (click)="forgotStep.set('request'); errorMessage.set('')"
                      class="text-orange-600 hover:text-orange-700 font-medium cursor-pointer"
                    >
                      Cambiar correo / volver atrás
                    </button>
                  </div>
                </form>
              }
            </div>
          } @else {
            <form (ngSubmit)="submitRegister()" class="space-y-3.5">
              <!-- 1. Correo electrónico -->
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  name="regEmail"
                  [(ngModel)]="registerData.email"
                  (ngModelChange)="onFormChange()"
                  required
                  placeholder="cliente@correo.pe"
                  class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
                @if (registerData.email && !isEmailFormatValid()) {
                  <p class="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <svg class="h-3.5 w-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>Ingresa un correo electrónico válido (ej: nombre&#64;correo.com)</span>
                  </p>
                }
              </div>

              <!-- 2. Tipo y Número de documento (Opcional - DNI 8 / RUC 11) -->
              <div class="grid grid-cols-3 gap-2.5">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    Documento <span class="text-orange-600 font-bold">*</span>
                  </label>
                  <select
                    name="documentType"
                    [(ngModel)]="registerData.documentType"
                    (ngModelChange)="onDocumentTypeChange()"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-base sm:text-sm font-medium text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  >
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                    <option value="CE">C.E.</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    {{ registerData.documentType === 'RUC' ? 'Número de RUC' : registerData.documentType === 'DNI' ? 'Número de DNI' : 'Número de documento' }}
                    <span class="text-orange-600 font-bold">*</span>
                  </label>
                  <div class="relative flex items-center">
                    <input
                      type="text"
                      name="documentNumber"
                      [(ngModel)]="registerData.documentNumber"
                      (ngModelChange)="onRegisterDocumentChange($event)"
                      (blur)="onRegisterDocumentChange(registerData.documentNumber || '')"
                      [attr.maxlength]="expectedDocMaxLength()"
                      inputmode="numeric"
                      [placeholder]="registerData.documentType === 'RUC' ? 'Ej: 20608899114' : 'Ej: 71156519'"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3.5 pr-20 py-2 text-base sm:text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                    <div class="absolute right-1.5 flex items-center gap-1">
                      @if (isLookingUpDocument()) {
                        <span class="p-1.5 text-orange-600">
                          <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                          </svg>
                        </span>
                      } @else {
                        <button
                          type="button"
                          (click)="onRegisterDocumentChange(registerData.documentNumber || '')"
                          title="Consultar número de documento"
                          class="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-50 border border-orange-200 transition"
                        >
                          Buscar
                        </button>
                      }
                    </div>
                  </div>
                  @if (isDocNumberInvalid()) {
                    <p class="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                      <svg class="h-3.5 w-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>{{ docNumberValidationMessage() }}</span>
                    </p>
                  }
                </div>
              </div>

              @if (docNotFoundNotice()) {
                <div class="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
                  <svg class="h-4 w-4 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    No encontramos el documento. Puedes escribir tu nombre directamente en la casilla inferior.
                  </span>
                </div>
              }

              <!-- 3. Nombre completo / Razón social -->
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  {{ registerData.documentType === 'RUC' ? 'Razón social *' : 'Nombre completo *' }}
                </label>
                <input
                  type="text"
                  id="registerFullNameInput"
                  name="fullName"
                  [(ngModel)]="registerData.fullName"
                  (ngModelChange)="onFormChange()"
                  required
                  [placeholder]="registerData.documentType === 'RUC' ? 'Razón social de la empresa' : 'Nombres y apellidos completos'"
                  class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition"
                />
              </div>

              <!-- 4. Celular (opcional - 9 dígitos) & Contraseña -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    Celular * <span class="text-xs text-orange-600 font-semibold">(obligatorio - 9 dígitos)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    [(ngModel)]="registerData.phone"
                    (ngModelChange)="onPhoneChange($event)"
                    maxlength="9"
                    inputmode="numeric"
                    placeholder="999888777"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                  @if (isPhoneInvalid()) {
                    <p class="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                      <svg class="h-3.5 w-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>Debe tener 9 dígitos y empezar con 9</span>
                    </p>
                  }
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Contraseña *</label>
                  <div class="relative">
                    <input
                      [type]="showRegisterPassword() ? 'text' : 'password'"
                      name="regPassword"
                      [(ngModel)]="registerData.password"
                      (ngModelChange)="onPasswordChange($event)"
                      required
                      minlength="8"
                      placeholder="Mínimo 8 caracteres"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3 pr-10 py-2 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      (click)="showRegisterPassword.set(!showRegisterPassword())"
                      class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition"
                      [attr.aria-label]="showRegisterPassword() ? 'Ocultar contraseña' : 'Ver contraseña'"
                    >
                      @if (showRegisterPassword()) {
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      } @else {
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      }
                    </button>
                  </div>
                  <!-- Live Password Complexity Checklist -->
                  <div class="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                    <span
                      class="flex items-center justify-center gap-1 rounded py-1 border transition"
                      [class]="isPassLengthValid() ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'"
                    >
                      <span>{{ isPassLengthValid() ? '✓' : '○' }}</span>
                      <span>8+ carac.</span>
                    </span>
                    <span
                      class="flex items-center justify-center gap-1 rounded py-1 border transition"
                      [class]="isPassNumberValid() ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'"
                    >
                      <span>{{ isPassNumberValid() ? '✓' : '○' }}</span>
                      <span>Número</span>
                    </span>
                    <span
                      class="flex items-center justify-center gap-1 rounded py-1 border transition"
                      [class]="isPassSpecialValid() ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' : 'bg-gray-50 text-gray-400 border-gray-200'"
                    >
                      <span>{{ isPassSpecialValid() ? '✓' : '○' }}</span>
                      <span>Especial</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Official Google reCAPTCHA v3 Legal Notice -->
              <p class="text-[11px] text-gray-500 text-center leading-relaxed">
                Protegido por Google reCAPTCHA v3. Aplican la
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline font-medium">Privacidad</a> y los
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline font-medium">Términos de Servicio</a> de Google.
              </p>

              <p class="text-[11px] text-gray-500 leading-snug">
                Enviaremos un correo de confirmación de bienvenida a tu dirección registrada.
              </p>

              @if (errorMessage()) {
                <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {{ errorMessage() }}
                </div>
              }

              <button
                type="submit"
                [disabled]="isLoading()"
                class="w-full min-h-[44px] rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
              >
                {{ isLoading() ? 'Creando cuenta...' : 'Crear cuenta' }}
              </button>
            </form>
          }

          <div class="mt-5 pt-4 border-t border-gray-100 text-center">
            <a routerLink="/" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-orange-600 transition">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Volver al catálogo de repuestos</span>
            </a>
          </div>
        </div>

        <!-- Security & Commercial Trust Strip -->
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-2xs">
            <span class="block text-[10px] font-extrabold text-gray-900">Validación DNI / RUC</span>
            <span class="block text-[10px] text-gray-500">Datos Oficiales</span>
          </div>
          <div class="rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-2xs">
            <span class="block text-[10px] font-extrabold text-emerald-700">Precios Mayoristas</span>
            <span class="block text-[10px] text-gray-500">Desde 4 unidades</span>
          </div>
          <div class="rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-2xs">
            <span class="block text-[10px] font-extrabold text-orange-600">Sesión Cifrada</span>
            <span class="block text-[10px] text-gray-500">Seguridad JWT</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly lookupService = inject(LookupService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly recaptchaV3 = inject(RecaptchaV3Service);

  readonly mode = signal<'login' | 'register' | 'forgot'>('login');
  readonly forgotStep = signal<'request' | 'reset'>('request');
  readonly showResetPassword = signal(false);
  readonly resetSuccessMessage = signal('');
  readonly recoveryChannel = signal<'EMAIL' | 'IDENTITY_VERIFICATION' | 'CONTACT_ADMIN'>('EMAIL');
  readonly recoveryCanVerifyIdentity = signal(false);
  readonly recoveryRequiresDocument = signal(true);
  readonly recoveryRequiresPhone = signal(true);
  readonly recoveryMaskedDocument = signal('');
  readonly recoveryMaskedPhone = signal('');
  readonly recoveryNotice = signal('');
  forgotEmail = '';
  forgotCode = '';
  forgotDocument = '';
  forgotPhone = '';
  newResetPassword = '';
  confirmResetPassword = '';

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const destination = returnUrl || this.auth.defaultHomeForUser();
      void this.router.navigateByUrl(destination);
      return;
    }

    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'register') {
      this.mode.set('register');
    }
  }
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  readonly showLoginPassword = signal(false);
  readonly showRegisterPassword = signal(false);

  readonly isLookingUpDocument = signal(false);
  readonly docVerified = signal(false);
  readonly docNotFoundNotice = signal(false);
  readonly docTaxStatus = signal('');
  private lastLookedUpNumber = '';

  readonly regPassword = signal('');
  readonly formVersion = signal(0);

  readonly isPassLengthValid = computed(() => this.regPassword().length >= 8);
  readonly isPassNumberValid = computed(() => /\d/.test(this.regPassword()));
  readonly isPassSpecialValid = computed(() => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(this.regPassword()));

  readonly isPasswordFullyValid = computed(() =>
    this.isPassLengthValid() && this.isPassNumberValid() && this.isPassSpecialValid()
  );

  readonly isResetPassLengthValid = computed(() => {
    this.formVersion();
    return (this.newResetPassword || '').length >= 8;
  });
  readonly isResetPassNumberValid = computed(() => {
    this.formVersion();
    return /\d/.test(this.newResetPassword || '');
  });
  readonly isResetPassSpecialValid = computed(() => {
    this.formVersion();
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(this.newResetPassword || '');
  });
  readonly isResetPassMatch = computed(() => {
    this.formVersion();
    return Boolean(this.newResetPassword && this.newResetPassword === this.confirmResetPassword);
  });
  readonly isResetPasswordFullyValid = computed(() =>
    this.isResetPassLengthValid() && this.isResetPassNumberValid() && this.isResetPassSpecialValid() && this.isResetPassMatch()
  );
  readonly isResetFormReady = computed(() => {
    this.formVersion();
    if (!this.isResetPasswordFullyValid()) return false;
    if (this.recoveryChannel() === 'EMAIL') {
      return (this.forgotCode || '').trim().length === 6;
    }
    if (this.recoveryChannel() === 'IDENTITY_VERIFICATION') {
      const docOk = !this.recoveryRequiresDocument() || (this.forgotDocument || '').trim().length >= 8;
      const phoneOk = !this.recoveryRequiresPhone() || (this.forgotPhone || '').replace(/\D/g, '').length >= 6;
      return docOk && phoneOk;
    }
    return false;
  });

  readonly isEmailFormatValid = computed(() => {
    this.formVersion();
    const email = (this.registerData.email || '').trim();
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  });

  readonly isPhoneInvalid = computed(() => {
    this.formVersion();
    const p = (this.registerData.phone || '').trim();
    if (!p) return false;
    return !(/^9\d{8}$/.test(p));
  });

  readonly isDocNumberInvalid = computed(() => {
    this.formVersion();
    const doc = (this.registerData.documentNumber || '').trim();
    if (!doc) return false;
    if (this.registerData.documentType === 'DNI') return doc.length !== 8;
    if (this.registerData.documentType === 'RUC') return doc.length !== 11;
    return false;
  });

  readonly docNumberValidationMessage = computed(() => {
    this.formVersion();
    const doc = (this.registerData.documentNumber || '').trim();
    if (this.registerData.documentType === 'DNI') {
      return `El DNI debe tener exactamente 8 dígitos (ingresaste ${doc.length})`;
    }
    if (this.registerData.documentType === 'RUC') {
      return `El RUC debe tener exactamente 11 dígitos (ingresaste ${doc.length})`;
    }
    return '';
  });

  readonly expectedDocMaxLength = computed(() => {
    this.formVersion();
    switch (this.registerData.documentType) {
      case 'DNI': return 8;
      case 'RUC': return 11;
      case 'CE': return 15;
      case 'PASAPORTE': return 12;
      default: return 12;
    }
  });

  readonly isRegisterFormReady = computed(() => {
    this.formVersion();
    const emailOk = this.isEmailFormatValid();
    const docNum = (this.registerData.documentNumber || '').trim();
    let docOk = true;
    if (docNum.length > 0) {
      const expLen = this.registerData.documentType === 'RUC' ? 11 : this.registerData.documentType === 'DNI' ? 8 : null;
      docOk = expLen ? docNum.length === expLen : true;
    }
    const nameOk = (this.registerData.fullName || '').trim().length >= 3;
    const phoneOk = !this.isPhoneInvalid();
    const passOk = this.isPasswordFullyValid();
    return Boolean(emailOk && docOk && nameOk && phoneOk && passOk);
  });

  onPasswordChange(val: string): void {
    this.registerData.password = val || '';
    this.regPassword.set(val || '');
    this.formVersion.update((v) => v + 1);
  }

  onPhoneChange(val: string): void {
    const clean = (val || '').replace(/\D/g, '').slice(0, 9);
    this.registerData.phone = clean;
    this.formVersion.update((v) => v + 1);
  }

  onFormChange(): void {
    this.formVersion.update((v) => v + 1);
  }

  loginEmail = '';
  loginPassword = '';

  registerData: RegisterRequest = {
    fullName: '',
    email: '',
    password: '',
    phone: '',
    documentType: 'DNI',
    documentNumber: '',
  };

  onDocumentTypeChange(): void {
    this.docVerified.set(false);
    this.docNotFoundNotice.set(false);
    this.docTaxStatus.set('');
    this.lastLookedUpNumber = '';
    if (this.registerData.documentNumber) {
      this.onRegisterDocumentChange(this.registerData.documentNumber);
    }
  }

  onRegisterDocumentChange(rawValue?: string): void {
    if (this.registerData.documentType === 'CE') {
      this.docVerified.set(false);
      this.docNotFoundNotice.set(false);
      this.docTaxStatus.set('');
      return;
    }

    let digits = (rawValue || '').replace(/\D/g, '');
    if (this.registerData.documentType === 'DNI') {
      digits = digits.slice(0, 8);
    } else if (this.registerData.documentType === 'RUC') {
      digits = digits.slice(0, 11);
    }

    this.registerData.documentNumber = digits;
    this.formVersion.update((v) => v + 1);

    if (
      this.registerData.documentType === 'DNI' &&
      digits.length === 11 &&
      (digits.startsWith('10') || digits.startsWith('20'))
    ) {
      this.registerData.documentType = 'RUC';
    }

    const expectedLen = this.registerData.documentType === 'RUC' ? 11 : 8;
    if (digits.length !== expectedLen) {
      this.docVerified.set(false);
      this.docNotFoundNotice.set(false);
      this.docTaxStatus.set('');
      if (digits.length < expectedLen) {
        this.lastLookedUpNumber = '';
      }
      return;
    }

    if (digits === this.lastLookedUpNumber) {
      return;
    }
    this.lastLookedUpNumber = digits;
    this.isLookingUpDocument.set(true);
    this.docNotFoundNotice.set(false);

    this.lookupService
      .lookupDocument(digits)
      .pipe(finalize(() => this.isLookingUpDocument.set(false)))
      .subscribe({
        next: (res) => {
          const resolvedName = (res.businessName || res.fullName || '').trim();
          if (res.found && resolvedName) {
            this.registerData.fullName = resolvedName;
            this.docVerified.set(true);
            this.docNotFoundNotice.set(false);
            this.docTaxStatus.set(res.documentType === 'RUC' ? res.taxStatus || '' : '');
            this.formVersion.update((v) => v + 1);
          } else {
            this.lastLookedUpNumber = '';
            this.docVerified.set(false);
            this.docNotFoundNotice.set(true);
            this.docTaxStatus.set('');
            setTimeout(() => {
              document.getElementById('registerFullNameInput')?.focus();
            }, 100);
          }
        },
        error: () => {
          this.lastLookedUpNumber = '';
          this.docVerified.set(false);
          this.docNotFoundNotice.set(true);
          this.docTaxStatus.set('');
        },
      });
  }

  submitLogin(): void {
    this.executeLogin();
  }

  openForgotPassword(): void {
    this.mode.set('forgot');
    this.forgotStep.set('request');
    this.errorMessage.set('');
    this.resetSuccessMessage.set('');
    if (this.loginEmail) {
      this.forgotEmail = this.loginEmail.trim();
    }
  }

  submitForgotPasswordRequest(): void {
    const email = (this.forgotEmail || '').trim().toLowerCase();
    if (!email) {
      this.errorMessage.set('Por favor ingresa tu correo electrónico.');
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.auth.forgotPassword(email)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          if (!res.success || res.deliveryChannel === 'NOT_FOUND') {
            const msg = res.message || 'No encontramos una cuenta registrada con ese correo electrónico.';
            this.errorMessage.set(msg);
            this.toast.error('Correo no encontrado', msg);
            return;
          }

          const channel: 'EMAIL' | 'IDENTITY_VERIFICATION' | 'CONTACT_ADMIN' =
            res.deliveryChannel ??
            (res.emailSent
              ? 'EMAIL'
              : res.canVerifyIdentity
                ? 'IDENTITY_VERIFICATION'
                : 'CONTACT_ADMIN');

          this.recoveryChannel.set(channel);
          this.recoveryCanVerifyIdentity.set(Boolean(res.canVerifyIdentity));
          this.recoveryRequiresDocument.set(res.requiresDocument !== false);
          this.recoveryRequiresPhone.set(Boolean(res.requiresPhone));
          this.recoveryMaskedDocument.set(res.maskedDocument || '');
          this.recoveryMaskedPhone.set(res.maskedPhone || '');
          this.recoveryNotice.set(res.message || '');

          this.forgotCode = '';
          this.forgotDocument = '';
          this.forgotPhone = '';
          this.newResetPassword = '';
          this.confirmResetPassword = '';
          this.onFormChange();
          this.forgotStep.set('reset');

          if (channel === 'EMAIL') {
            this.toast.success('Código enviado', res.message || 'Hemos enviado el código a tu correo.');
          } else if (channel === 'IDENTITY_VERIFICATION') {
            this.toast.info(
              'Verificación de identidad',
              'Valida tu DNI/RUC y celular registrados para cambiar tu contraseña al instante.'
            );
          } else {
            this.toast.warning(
              'Validación administrativa requerida',
              'Solicita el restablecimiento con un administrador del sistema.'
            );
          }
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo procesar la recuperación. Inténtalo más tarde.';
          this.errorMessage.set(msg);
          this.toast.error('Error al recuperar contraseña', msg);
        }
      });
  }

  submitResetPasswordConfirm(): void {
    const email = (this.forgotEmail || '').trim().toLowerCase();
    const code = (this.forgotCode || '').trim();
    const documentNumber = (this.forgotDocument || '').trim();
    const phone = (this.forgotPhone || '').trim();
    const newPass = this.newResetPassword || '';
    const confirmPass = this.confirmResetPassword || '';
    const channel = this.recoveryChannel();

    if (channel === 'EMAIL' && (!code || code.length !== 6)) {
      this.errorMessage.set('El código debe contener exactamente 6 dígitos.');
      return;
    }
    if (channel === 'IDENTITY_VERIFICATION') {
      if (this.recoveryRequiresDocument() && documentNumber.length < 8) {
        this.errorMessage.set('Ingresa el número de DNI o RUC registrado en tu cuenta.');
        return;
      }
      if (this.recoveryRequiresPhone() && phone.replace(/\D/g, '').length < 6) {
        this.errorMessage.set('Ingresa el número de celular registrado en tu cuenta.');
        return;
      }
    }
    if (newPass.length < 8) {
      this.errorMessage.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!/\d/.test(newPass)) {
      this.errorMessage.set('La nueva contraseña debe incluir al menos un número.');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPass)) {
      this.errorMessage.set('La nueva contraseña debe incluir al menos un carácter especial (ej: @, #, $, !, %, *, etc.).');
      return;
    }
    if (newPass !== confirmPass) {
      this.errorMessage.set('Las contraseñas ingresadas no coinciden.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.auth.resetPassword(
      channel === 'EMAIL'
        ? { email, code, newPassword: newPass }
        : { email, documentNumber, phone, newPassword: newPass }
    )
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.toast.success('¡Contraseña restablecida!', res.message || 'Tu contraseña ha sido actualizada.');
          this.resetSuccessMessage.set(res.message || 'Contraseña cambiada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.');
          this.loginEmail = email;
          this.loginPassword = '';
          this.forgotCode = '';
          this.forgotDocument = '';
          this.forgotPhone = '';
          this.newResetPassword = '';
          this.confirmResetPassword = '';
          this.onFormChange();
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo validar tu identidad o el código expiró. Inténtalo de nuevo.';
          this.errorMessage.set(msg);
          this.toast.error('Error al restablecer', msg);
        }
      });
  }

  private executeLogin(preferredRoute?: string): void {
    if (!this.loginEmail.trim() || !this.loginPassword) return;
    this.errorMessage.set('');
    this.isLoading.set(true);

    this.auth
      .login({ email: this.loginEmail.trim(), password: this.loginPassword })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.toast.success(
            `Hola, ${res.user.fullName}`,
            'Has iniciado sesión correctamente.'
          );
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          const destination = returnUrl || preferredRoute || this.auth.defaultHomeForUser();
          void this.router.navigateByUrl(destination);
        },
        error: (err) => {
          const msg =
            err?.status === 0
              ? 'No se pudo conectar con el servidor. Verifica tu conexión o que el servicio esté activo.'
              : err?.error?.message || 'Correo o contraseña incorrectos. Inténtalo nuevamente.';
          this.errorMessage.set(msg);
          this.toast.error('No se pudo iniciar sesión', msg);
        },
      });
  }

  async submitRegister(): Promise<void> {
    this.errorMessage.set('');

    const email = (this.registerData.email || '').trim();
    const docNum = (this.registerData.documentNumber || '').trim();
    const fullName = (this.registerData.fullName || '').trim();
    const password = this.registerData.password || '';

    if (!email) {
      this.errorMessage.set('Por favor ingresa tu correo electrónico.');
      this.toast.error('Campo requerido', 'El correo electrónico es obligatorio.');
      return;
    }
    if (!this.isEmailFormatValid()) {
      this.errorMessage.set('El formato del correo electrónico no es válido.');
      this.toast.error('Formato inválido', 'Ingresa un correo electrónico válido (ej: nombre@correo.com).');
      return;
    }
    if (docNum) {
      const expectedDocLen = this.registerData.documentType === 'RUC' ? 11 : this.registerData.documentType === 'DNI' ? 8 : null;
      if (expectedDocLen && docNum.length !== expectedDocLen) {
        const msg = `El ${this.registerData.documentType} debe contener exactamente ${expectedDocLen} dígitos.`;
        this.errorMessage.set(msg);
        this.toast.error('Documento incompleto', msg);
        return;
      }
    }
    if (this.isPhoneInvalid()) {
      this.errorMessage.set('El número de celular debe tener exactamente 9 dígitos y empezar con 9.');
      this.toast.error('Celular inválido', 'El celular debe tener 9 dígitos y empezar con 9 (ej: 987654321).');
      return;
    }
    if (!fullName) {
      if (docNum.length === 8 || docNum.length === 11) {
        this.isLoading.set(true);
        this.lookupService
          .lookupDocument(docNum)
          .pipe(finalize(() => this.isLoading.set(false)))
          .subscribe({
            next: (res) => {
              const resolved = (res.businessName || res.fullName || '').trim();
              if (resolved) {
                this.registerData.fullName = resolved;
                this.docVerified.set(true);
                void this.submitRegister();
              } else {
                this.errorMessage.set('Por favor escribe tu nombre completo o razón social.');
                this.toast.error('Campo requerido', 'El nombre completo es obligatorio.');
                document.getElementById('registerFullNameInput')?.focus();
              }
            },
            error: () => {
              this.errorMessage.set('Por favor escribe tu nombre completo o razón social.');
              this.toast.error('Campo requerido', 'El nombre completo es obligatorio.');
              document.getElementById('registerFullNameInput')?.focus();
            },
          });
        return;
      }
      this.errorMessage.set('Por favor ingresa tu nombre completo o razón social.');
      this.toast.error('Campo requerido', 'El nombre completo es obligatorio.');
      document.getElementById('registerFullNameInput')?.focus();
      return;
    }
    if (!this.isPassLengthValid()) {
      this.errorMessage.set('La contraseña debe tener al menos 8 caracteres.');
      this.toast.error('Contraseña débil', 'La contraseña debe tener un mínimo de 8 caracteres.');
      return;
    }
    if (!this.isPassNumberValid()) {
      this.errorMessage.set('La contraseña debe contener al menos un número (0-9).');
      this.toast.error('Contraseña débil', 'La contraseña debe contener al menos un número.');
      return;
    }
    if (!this.isPassSpecialValid()) {
      this.errorMessage.set('La contraseña debe contener al menos un caracter especial (ej: @, #, $, !, %, *, etc.).');
      this.toast.error('Contraseña débil', 'La contraseña debe contener al menos un caracter especial.');
      return;
    }

    this.isLoading.set(true);

    let recaptchaToken = '';
    try {
      recaptchaToken = await this.recaptchaV3.execute('register');
    } catch (e) {
      console.warn('Google reCAPTCHA v3 warning:', e);
    }

    const payload: RegisterRequest = {
      email,
      fullName,
      phone: (this.registerData.phone || '').trim() || undefined,
      documentType: docNum ? this.registerData.documentType : undefined,
      documentNumber: docNum || undefined,
      password,
      recaptchaToken,
    };

    this.auth
      .register(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.toast.success(
            'Cuenta creada con éxito',
            `Bienvenido, ${res.user.fullName}. Enviamos un correo de confirmación a ${res.user.email}.`
          );
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
          void this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            'No se pudo completar el registro. Revisa los datos ingresados.';
          this.errorMessage.set(msg);
          this.toast.error('Error en registro', msg);
        },
      });
  }
}
