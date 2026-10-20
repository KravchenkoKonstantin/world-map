import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl'; // Импортируем функцию
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'; // Импортируем URL воркера
import 'maplibre-gl/dist/maplibre-gl.css';

// Указываем MapLibre путь к воркеру (делается один раз при загрузке модуля)
setWorkerUrl(workerUrl);
import './App.css';

function App() {
  // Ссылка на DOM-элемент, внутри которого будет карта
  const mapContainer = useRef(null);
  // Ссылка на сам объект карты
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return; // Защита от повторного создания карты

    // 1. ИНИЦИАЛИЗАЦИЯ КАРТЫ
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      // Светлая подложка от Carto
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 20], // Центр карты [долгота, широта]
      zoom: 1.5        // Начальный зум
    });

    // Кнопки управления (зум)
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 2. ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ
    map.current.on('load', () => {
      // Делаем запрос к нашему бэкенду на FastAPI
      fetch('http://localhost:8000/api/countries')
        .then(res => res.json())
        .then(data => {
          
          // Добавляем полученные данные как источник
          map.current.addSource('countries', {
            type: 'geojson',
            data: data
          });

          // Слой заливки (цвет стран)
          map.current.addLayer({
            id: 'countries-fill',
            type: 'fill',
            source: 'countries',
            paint: {
              'fill-color': '#3498db', // Синий
              'fill-opacity': 0.4      // Прозрачность
            }
          });

          // Слой границ
          map.current.addLayer({
            id: 'countries-border',
            type: 'line',
            source: 'countries',
            paint: {
              'line-color': '#2c3e50', // Темно-серый
              'line-width': 1
            }
          });

          // 3. ОБРАБОТКА КЛИКОВ
          map.current.on('click', 'countries-fill', (e) => {
            const feature = e.features[0];

            // Берем русское название из базы данных
            const countryName = feature.properties.lvc_NAME_R || feature.properties.NAME_EN || feature.properties.NAME || 'Неизвестно';

            // Создаем всплывающее окно
            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="padding: 10px;">
                  <h3 style="margin: 0 0 5px 0; color: #333;">${countryName}</h3>
                  <p style="margin: 0; font-size: 12px; color: #666;">Данные из PostGIS</p>
                </div>
              `)
              .addTo(map.current);
          });

          // Меняем курсор при наведении
          map.current.on('mouseenter', 'countries-fill', () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });
          map.current.on('mouseleave', 'countries-fill', () => {
            map.current.getCanvas().style.cursor = '';
          });
        });
    });
  }, []);

  // Возвращаем контейнер для карты
  return (
    <div className="App">
      <div ref={mapContainer} style={{ width: '100vw', height: '100vh' }} />
    </div>
  );
}

export default App;