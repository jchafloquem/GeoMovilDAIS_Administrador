import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

// Interfaz para tipado fuerte
export interface Registro {
  internal_key: string;
  dni_productor: string;
  nombre_completo: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  tipo_cultivo: string;
  area_ha: number;
  perimetro_m?: number;
  txt_departamento?: string;
  txt_provincia?: string;
  txt_distrito?: string;
  fecha_creacion: string;
  geojson: any; // Objeto GeoJSON
  fotos: { id: number; tipo_foto: string; url: string; ruta_foto?: string }[];
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  // URL limpia. Si usas localhost, asegúrate de que no termine en / para evitar el // en el log
  private apiUrl = 'http://localhost:3000/geodaismovil/api';


  // Signals para el estado reactivo
  registros = signal<Registro[]>([]);
  selectedRegistro = signal<Registro | null>(null);
  loading = signal<boolean>(false);

  constructor() {
    // Solo cargar datos si estamos en el navegador para evitar bloqueos en SSR
    if (isPlatformBrowser(this.platformId)) {
      this.loadRegistros();
    }
  }

  loadRegistros() {
    this.loading.set(true);
    const url = `${this.apiUrl}/registros`;
    console.debug('[DataService] loadRegistros:', url);
    this.http.get<Registro[]>(url)
      .subscribe({
        next: (data) => {
          const registros = Array.isArray(data) ? data : [data];
          console.debug('[DataService] registros recibidos:', registros);
          this.registros.set(registros);
          if (!this.selectedRegistro() && registros.length > 0) {
            this.selectedRegistro.set(registros[0]);
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error(`Error loading records from ${url}:`, err);
          this.loading.set(false);
        }
      });
  }

  selectRegistro(registro: Registro) {
    this.selectedRegistro.set(registro);
  }
}
