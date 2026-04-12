import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

// Interfaz para tipado fuerte
export interface Registro {
  id: number;
  internalKey: string;
  dniProductor: string;
  nombreCompleto: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  tipoCultivo: string;
  area: number;
  perimetro?: number;
  departamentoInei?: string;
  provinciaInei?: string;
  distritoInei?: string;
  fechaCreacion: string;
  geom: any; // Mapeado desde 'geom' del JSON (antes geojson)
  centroide?: string;
  ubigeoInei?: string;
  caserio?: string;
  observaciones?: string;
  profesionalNombres?: string;
  profesionalApellidos?: string;
  fotosAsociadas: {
    id: number;
    tipoFoto: string;
    rutaFoto: string;
    internalKey?: string;
    productor?: string;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  // URL limpia. Si usas localhost, asegúrate de que no termine en / para evitar el // en el log
  //private apiUrl = 'http://localhost:3000/geodaismovil/api';
  private apiUrl = 'http://localhost:8080/geodaismovil/api';


  // Signals para el estado reactivo
  registros = signal<Registro[]>([]);
  selectedRegistro = signal<Registro | null>(null);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  constructor() {}

  loadRegistros() {
    if (!isPlatformBrowser(this.platformId) || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    const url = `${this.apiUrl}/registros`;
    console.debug('[DataService] Intentando cargar registros desde:', url);

    this.http.get<Registro[]>(url)
      .subscribe({
        next: (data) => {
          const registros = Array.isArray(data) ? data : [data];
          console.debug('[DataService] Registros recibidos con éxito:', registros.length);
          this.registros.set(registros);
          if (!this.selectedRegistro() && registros.length > 0) {
            this.selectedRegistro.set(registros[0]);
          }
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          console.error('[DataService] Error en la petición:', err);

          // Intentamos extraer el mensaje más descriptivo posible
          const msg = err.error?.message || err.error?.error || err.statusText || 'Error Interno';
          const detail = err.error?.path ? ` en ${err.error.path}` : '';

          this.errorMessage.set(`Error ${err.status}: ${msg}${detail}`);
          this.loading.set(false);
        }
      });
  }

  selectRegistro(registro: Registro) {
    this.selectedRegistro.set(registro);
  }
}
