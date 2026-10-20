import geopandas as gpd
from sqlalchemy import create_engine
import time

DB_CONNECTION = "postgresql+psycopg://mapuser:mappassword@localhost:5432/mapdb"
engine = create_engine(DB_CONNECTION)

print("Чтение файла LVC.geojson...")
start_time = time.time()

gdf = gpd.read_file("../LVC geojson/LVC.geojson")

if gdf.crs != "EPSG:4326":
    gdf = gdf.to_crs("EPSG:4326")

print(f"Файл прочитан. Найдено объектов: {len(gdf)}")
print("Столбцы в файле:", list(gdf.columns))

print("Заливка данных в PostgreSQL...")
gdf.to_postgis(
    name="countries", 
    con=engine, 
    if_exists="replace", 
    index=False
)

print(f"Готово! Данные загружены за {time.time() - start_time:.2f} секунд.")