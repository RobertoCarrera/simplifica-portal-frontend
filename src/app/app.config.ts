import {
  ApplicationConfig,
  APP_INITIALIZER,
  inject,
  provideZoneChangeDetection,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import {
  provideHttpClient,
} from "@angular/common/http";
import { provideAnimations } from "@angular/platform-browser/animations";
import { PORTAL_ROUTES } from "./portal.routes";
import { RuntimeConfigService } from "./core/config/runtime-config.service";

function initRuntimeConfig() {
  const cfg = inject(RuntimeConfigService);
  return () => cfg.load();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(PORTAL_ROUTES),
    provideHttpClient(),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      useFactory: initRuntimeConfig,
      multi: true,
    },
  ],
};
