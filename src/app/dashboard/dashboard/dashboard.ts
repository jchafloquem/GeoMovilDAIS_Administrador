import { Component, inject, effect, ViewChild, ElementRef, AfterViewInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';

import { DataService } from '../../services/data.service';
import type { Map, GeoJSON } from 'leaflet'; // Importamos solo los TIPOS, no la librería completa

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    DatePipe
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements AfterViewInit {

    dataService = inject(DataService);
    private platformId = inject(PLATFORM_ID); // Para detectar si estamos en el navegador

    private L: any; // Instancia de Leaflet cacheada
    private map: Map | undefined;
    private geoJsonLayer: GeoJSON | undefined;
    private isMapReady = signal(false);

    // Propiedad para controlar el modal de fotos
    selectedPhotoIndex: number | null = null;
    currentCoordinates: string | null = null;
    activeTab: 'PARCELA' | 'DNI' = 'PARCELA';

    @ViewChild('mapContainer') mapContainer!: ElementRef;

    constructor() {
    // Effect: Reacciona automáticamente cuando cambia el registro seleccionado
    effect(() => {
      const selected = this.dataService.selectedRegistro();
      if (selected && this.isMapReady()) {
        this.activeTab = 'PARCELA'; // Resetear a Parcela al cambiar de productor
        this.showGeometry(selected);
      }
    });
  }

  async ngAfterViewInit() {
    // Solo inicializamos el mapa y solicitamos datos si estamos en el navegador
    if (isPlatformBrowser(this.platformId)) {
      await this.initMap();
      this.loadInitialData();
    }
  }

  private loadInitialData() {
    this.dataService.loadRegistros();
  }

  private async initMap() {
    if (!this.L) {
      // Importación dinámica única
      const module = await import('leaflet') as any;
      this.L = module.default?.map ? module.default : module;
    }

    const L = this.L;
    if (!L || !L.map) return;

    // FIX: Corregir la ruta de los iconos de Leaflet para producción
    // Esto es necesario porque al compilar, Leaflet pierde la referencia a sus imágenes locales
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Inicializa el mapa centrado en Perú
    this.map = L.map(this.mapContainer.nativeElement, {
      maxZoom: 21 // Permite un zoom mucho más profundo
    }).setView([-9.00, -70.0152], 6);

    // Capa de Calles (OpenStreetMap)
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 21,
      maxNativeZoom: 19 // OSM suele tener tiles hasta el nivel 19
    });

    // Capa Satelital (Google Hybrid) - Mucho más estable y detallada para Perú
    const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      attribution: '© Google Maps',
      maxZoom: 21,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxNativeZoom: 20 // Google permite acercarse mucho más con fotos reales que Esri
    });

    // Añadir capa por defecto y el control de capas
    satellite.addTo(this.map!);
    L.control.layers({ "Satélite": satellite, "Calles": streets,  }).addTo(this.map!);

    this.isMapReady.set(true);
  }

  private showGeometry(registro: any) {
    if (!this.L || !this.map) return;
    const L = this.L;

    if (this.geoJsonLayer) {
      this.map?.removeLayer(this.geoJsonLayer);
    }

    if (registro.geom) {
      let geoData;
      try {
        // Aseguramos que el geojson sea un objeto (por si viene como string desde la API)
        geoData = typeof registro.geom === 'string'
          ? JSON.parse(registro.geom)
          : registro.geom;
      } catch (parseError) {
        console.error('Error al parsear la geometría (no es JSON válido):', registro.geom);
        return;
      }

      const layer = L.geoJSON(geoData, {
        style: { color: '#3880ff', weight: 4, fillOpacity: 0.4 },
        // Configuración para convertir puntos en marcadores CSS
        pointToLayer: (feature: any, latlng: any) => {
          return L.marker(latlng, {
            icon: L.divIcon({
              className: 'custom-marker-point', // Clase que definiremos en SCSS
              iconSize: [16, 16],   // Tamaño del círculo
              iconAnchor: [8, 8]    // Anclaje en el centro (mitad del tamaño)
            })
          });
        }
      });

      this.geoJsonLayer = layer;

      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          const center = bounds.getCenter();
          this.currentCoordinates = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;

          // Solo interactuamos con el mapa si ya está inicializado
          if (this.map) {
            layer.addTo(this.map);

            // AGREGAR MARCADOR VISUAL EN EL CENTROIDE
            L.marker(center).addTo(layer);

            this.map.fitBounds(bounds);
          }
        }
      } catch (e) {
        console.warn('Geometría inválida o vacía');
        this.currentCoordinates = null;
      }
    } else {
      this.currentCoordinates = null;
    }
  }

  // Métodos para el modal de fotos
  openPhoto(index: number) {
    this.selectedPhotoIndex = index;
  }

  closePhoto() {
    this.selectedPhotoIndex = null;
  }

  // Getter para obtener solo las fotos de la pestaña activa
  get currentPhotos() {
    const selected = this.dataService.selectedRegistro();
    if (!selected || !selected.fotosAsociadas) return [];

    return selected.fotosAsociadas.filter(f => {
      const isDni = f.tipoFoto.toUpperCase().includes('DNI');
      return this.activeTab === 'DNI' ? isDni : !isDni;
    });
  }

  nextPhoto() {
    const photos = this.currentPhotos;
    if (photos.length > 0 && this.selectedPhotoIndex !== null) {
      // Usamos módulo (%) para que al llegar al final vuelva al principio
      this.selectedPhotoIndex = (this.selectedPhotoIndex + 1) % photos.length;
    }
  }

  prevPhoto() {
    const photos = this.currentPhotos;
    if (photos.length > 0 && this.selectedPhotoIndex !== null) {
      // Sumamos la longitud antes del módulo para manejar índices negativos correctamente
      this.selectedPhotoIndex = (this.selectedPhotoIndex - 1 + photos.length) % photos.length;
    }
  }

  formatPhotoUrl(ruta: string | undefined): string | null {
    if (!ruta) return null;
    const rawData = ruta.trim();
    if (rawData.startsWith('http') || rawData.startsWith('data:image')) {
      return rawData;
    }
    return `data:image/jpeg;base64,${rawData}`;
  }

  get currentPhotoUrl(): string | null {
    const photos = this.currentPhotos;
    if (photos.length > 0 && this.selectedPhotoIndex !== null) {
      return this.formatPhotoUrl(photos[this.selectedPhotoIndex].rutaFoto);
    }
    return null;
  }
}
