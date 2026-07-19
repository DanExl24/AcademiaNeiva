import psycopg2
import os
from dotenv import load_dotenv

# Load env from backend/.env
backend_env_path = r'c:\Users\alejo\Downloads\segundoProyecto\backend\.env'
load_dotenv(backend_env_path)

db_host = os.environ.get("DB_HOST", "localhost")
db_port = os.environ.get("DB_PORT", "5432")
db_name = os.environ.get("DB_NAME", "AcademiaNeiva")
db_user = os.environ.get("DB_USER", "postgres")
db_password = os.environ.get("DB_PASSWORD", "postgres")

migration_path = r'c:\Users\alejo\Downloads\segundoProyecto\backend\src\migrations\014_soporte_tecnico.sql'

print(f"Connecting to database {db_name} on {db_host}:{db_port}...")
try:
    conn = psycopg2.connect(
        host=db_host,
        port=db_port,
        database=db_name,
        user=db_user,
        password=db_password
    )
    cur = conn.cursor()
    
    print(f"Reading migration file: {migration_path}")
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()
        
    print("Executing migration...")
    cur.execute(sql)
    conn.commit()
    print("Migration executed and committed successfully!")
    
    # Verify tables
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name IN ('tickets_soporte')
    """)
    tables = cur.fetchall()
    print("Created tables:", [t[0] for t in tables])
    
    cur.close()
    conn.close()

except Exception as e:
    print("Error executing migration:", e)
