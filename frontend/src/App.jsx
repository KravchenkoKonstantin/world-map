import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

setWorkerUrl(workerUrl);

const RU_TO_ISO = {
  'Россия': 'ru', 'США': 'us', 'Германия': 'de', 'Франция': 'fr',
  'Великобритания': 'gb', 'Китай': 'cn', 'Япония': 'jp', 'Бразилия': 'br',
  'Канада': 'ca', 'Австралия': 'au', 'Индия': 'in', 'Италия': 'it',
  'Испания': 'es', 'Украина': 'ua', 'Беларусь': 'by', 'Казахстан': 'kz',
  'Норвегия': 'no', 'Швеция': 'se', 'Финляндия': 'fi', 'Польша': 'pl',
  'Турция': 'tr', 'Египет': 'eg', 'ЮАР': 'za', 'Мексика': 'mx',
  'Аргентина': 'ar', 'Индонезия': 'id', 'Саудовская Аравия': 'sa'
};

const FALLBACK_COORDS = {
  'Россия': [100, 60], 'США': [-100, 40], 'Канада': [-100, 60], 'Китай': [105, 35], 'Бразилия': [-55, -10]
};

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('normal'); 
  const [legendRange, setLegendRange] = useState(null); 
  
  const countryDataRef = useRef({});
  const rawGeoJSON = useRef(null);
  const hoveredStateId = useRef(null);

  const applyChoropleth = (mapObj, geojsonData, metric) => {
    if (!mapObj.getSource('countries')) return;

    if (metric === 'normal') {
      mapObj.setPaintProperty('countries-fill', 'fill-color', '#3498db');
      mapObj.setPaintProperty('countries-fill', 'fill-opacity', [
        'case', ['boolean', ['feature-state', 'hover'], false], 0.7, 0.4
      ]);
      setLegendRange(null);
      return;
    }

    let minVal = Infinity;
    let maxVal = -Infinity;

    geojsonData.features.forEach(f => {
      const val = parseFloat(f.properties[metric]);
      if (!isNaN(val) && val !== -99) {
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    });

    if (minVal === Infinity) { minVal = 0; maxVal = 1; }

    let midVal = (minVal + maxVal) / 2;
  
    if (minVal === maxVal) {
      maxVal = minVal + 1;
      midVal = minVal + 0.5;
    } else if (minVal < 0 && maxVal > 0) {
      midVal = 0; 
    }

    const colorExpression = [
      'case',
      ['==', ['to-number', ['get', metric], -99], -99],
      '#bdc3c7', 
      [
        'interpolate',
        ['linear'],
        ['to-number', ['get', metric], -99], 
        minVal, '#e74c3c', 
        midVal, '#f1c40f', 
        maxVal, '#2ecc71' 
      ]
    ];

    mapObj.setPaintProperty('countries-fill', 'fill-color', colorExpression);
    mapObj.setPaintProperty('countries-fill', 'fill-opacity', [
      'case', ['boolean', ['feature-state', 'hover'], false], 1.0, 0.8
    ]);
    
    setLegendRange({
      min: minVal.toFixed(2),
      mid: midVal.toFixed(2),
      max: maxVal.toFixed(2)
    });
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 20],
      zoom: 1.5
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      map.current.getStyle().layers.forEach(layer => {
        if (layer.id.includes('place_country') || layer.id.includes('country_label')) {
          map.current.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      });

      fetch('http://localhost:8000/api/countries')
        .then(res => res.json())
        .then(data => {
          rawGeoJSON.current = data;

          const countryMap = {};
          data.features.forEach(f => {
            const name = f.properties.lvc_NAME_R;
            if (!name) return;
            if (!countryMap[name] || (f.properties.POP_EST && f.properties.POP_EST !== -99)) {
              countryMap[name] = f.properties;
            }
          });
          countryDataRef.current = countryMap;

          const uniqueNames = new Set();
          const labelFeatures = [];

          data.features.forEach(feature => {
            const name = feature.properties.lvc_NAME_R;
            if (feature.properties.TYPE === 'boundary' || !name) return;
            if (uniqueNames.has(name)) return;
              
            let lng = parseFloat(feature.properties.LABEL_X);
            let lat = parseFloat(feature.properties.LABEL_Y);

            if (isNaN(lng) || isNaN(lat) || lng === -99 || lat === -99) {
              if (FALLBACK_COORDS[name]) {
                lng = FALLBACK_COORDS[name][0];
                lat = FALLBACK_COORDS[name][1];
              } else { return; }
            }

            labelFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              properties: { name: name }
            });
            uniqueNames.add(name); 
          });

          const labelsData = { type: 'FeatureCollection', features: labelFeatures };

          map.current.addSource('countries', { type: 'geojson', data: data, promoteId: 'lvc_NAME_R' });
          map.current.addSource('country-labels', { type: 'geojson', data: labelsData });

          map.current.addLayer({
            id: 'countries-fill',
            type: 'fill',
            source: 'countries',
            paint: { 'fill-color': '#3498db', 'fill-opacity': 0.4 } 
          });

          map.current.addLayer({
            id: 'countries-border',
            type: 'line',
            source: 'countries',
            paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.5 }
          });

          map.current.addLayer({
            id: 'countries-label',
            type: 'symbol',
            source: 'country-labels',
            minzoom: 1,
            layout: {
              'text-field': ['get', 'name'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 14],
              'text-allow-overlap': false,
              'text-ignore-placement': false
            },
            paint: { 'text-color': '#1a252f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
          });

          applyChoropleth(map.current, data, 'normal');
          setIsLoading(false);

          map.current.on('mousemove', 'countries-fill', (e) => {
            if (e.features.length > 0) {
              const featureId = e.features[0].id; 
              if (featureId !== undefined && featureId !== null) {
                if (hoveredStateId.current !== null) {
                  map.current.setFeatureState({ source: 'countries', id: hoveredStateId.current }, { hover: false });
                }
                hoveredStateId.current = featureId;
                map.current.setFeatureState({ source: 'countries', id: hoveredStateId.current }, { hover: true });
              }
            }
          });

          map.current.on('mouseleave', 'countries-fill', () => {
            if (hoveredStateId.current !== null) {
              map.current.setFeatureState({ source: 'countries', id: hoveredStateId.current }, { hover: false });
              hoveredStateId.current = null;
            }
          });

          map.current.on('click', 'countries-fill', (e) => {
            const clickedName = e.features[0].properties.lvc_NAME_R;
            if (countryDataRef.current[clickedName]) {
              setSelectedCountry(countryDataRef.current[clickedName]);
            } else {
              setSelectedCountry(e.features[0].properties);
            }
          });

          map.current.on('mouseenter', 'countries-fill', () => { map.current.getCanvas().style.cursor = 'pointer'; });
          map.current.on('mouseleave', 'countries-fill', () => { map.current.getCanvas().style.cursor = ''; });
        })
        .catch(err => { console.error("Ошибка:", err); setIsLoading(false); });
    });
  }, []);

  const handleMetricChange = (e) => {
    const newMetric = e.target.value;
    setSelectedMetric(newMetric);
    if (map.current && rawGeoJSON.current) {
      applyChoropleth(map.current, rawGeoJSON.current, newMetric);
    }
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null || num === -99) return 'Нет данных';
    return num;
  };

  const getFlagCode = (iso2, iso3, nameRu) => {
    if (iso2 && iso2 !== '-99' && iso2.length === 2) return iso2.toLowerCase();
    if (nameRu && RU_TO_ISO[nameRu]) return RU_TO_ISO[nameRu];
    return null;
  };

  const flagCode = selectedCountry ? getFlagCode(selectedCountry.ISO_A2, selectedCountry.ISO_A3, selectedCountry.lvc_NAME_R) : null;

  const metricTitles = {
    'lvc_field_': 'lvc_field_',
    '_Ivc Belarus': '_Ivc Belarus',
    '_Difference': '_Difference (Разница)'
  };

  return (
    <div className="App" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <div 
        className="controls-panel"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 9999,
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Режим карты:</label>
        <select 
          value={selectedMetric} 
          onChange={handleMetricChange}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="normal">Обычный вид (синий)</option>
          <option value="_Difference">_Difference (Разница)</option>
          <option value="lvc_field_">lvc_field_</option>
          <option value="_Ivc Belarus">_Ivc Belarus</option>
        </select>
      </div>

      {selectedMetric !== 'normal' && legendRange && (
        <div className="legend" style={{ zIndex: 9999 }}>
          <h4>{metricTitles[selectedMetric]}</h4>
          <div className="legend-gradient"></div>
          <div className="legend-labels">
            <span>{legendRange.min}</span>
            <span>{legendRange.mid}</span>
            <span>{legendRange.max}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loader-container">
          <div className="spinner"></div>
          Загрузка карты мира...
        </div>
      )}

      {selectedCountry && (
        <div className="sidebar" style={{ zIndex: 9999 }}>
          <button className="close-btn" onClick={() => setSelectedCountry(null)}>✖</button>
          
          {flagCode ? (
            <img src={`https://flagcdn.com/w160/${flagCode}.png`} alt="Флаг" className="country-flag" onError={(e) => { e.target.src = 'https://via.placeholder.com/160x100?text=Флаг+не+найден'; }} />
          ) : (
            <div style={{ height: '100px', background: '#eee', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', color: '#999' }}>Флаг не найден</div>
          )}

          <h2>{selectedCountry.lvc_NAME_R || selectedCountry.NAME_EN || 'Неизвестно'}</h2>
          
          <div className="sidebar-info">
            <strong>lvc_field_</strong>
            {formatNumber(selectedCountry['lvc_field_'])}
          </div>
          
          <div className="sidebar-info">
            <strong>_Ivc Belarus</strong>
            {formatNumber(selectedCountry['_Ivc Belarus'])}
          </div>
          
        </div>
      )}
    </div>
  );
}

export default App;