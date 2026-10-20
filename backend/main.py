from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

app = FastAPI(
    title="World Map API",
    description="API для интерактивной карты мира",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONNECTION = "postgresql+psycopg://mapuser:mappassword@localhost:5432/mapdb"
engine = create_engine(DB_CONNECTION)


@app.get("/api/countries", summary="Получить все страны (GeoJSON)")
def get_countries():
    with engine.connect() as conn:
        # ИСПРАВЛЕНО: используем geometry вместо geom
        query = text("""
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', jsonb_agg(feature)
            ) as geojson
            FROM (
                SELECT jsonb_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(geometry)::jsonb,
                    'properties', to_jsonb(row) - 'geometry'
                ) as feature
                FROM countries row
            ) features;
        """)
        result = conn.execute(query).fetchone()
        
        if not result or not result[0]:
            raise HTTPException(status_code=404, detail="Данные в базе не найдены")
            
        return result[0]


@app.get("/api/countries/{country_name}", summary="Получить информацию о стране")
def get_country_info(country_name: str):
    with engine.connect() as conn:
        query = text('SELECT * FROM countries WHERE "lvc_NAME_R" = :name')
        result = conn.execute(query, {"name": country_name}).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=404, 
                detail=f"Страна с названием '{country_name}' не найдена"
            )
            
        country_data = dict(result._mapping)
        
        # ИСПРАВЛЕНО: удаляем колонку geometry
        country_data.pop('geometry', None) 
        
        return country_data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)