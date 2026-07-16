import fitz  # PyMuPDF
import psycopg2
from psycopg2.extras import execute_values
import re
import os
import argparse
import sys
from dotenv import load_dotenv

# Mapeo de grados del MEN (numéricos/ordinales) a los valores del sistema AcademiaNeiva
GRADE_MAP = {
    "1": "PRIMERO",
    "2": "SEGUNDO",
    "3": "TERCERO",
    "4": "CUARTO",
    "5": "QUINTO",
    "6": "SEXTO",
    "7": "SEPTIMO",
    "8": "OCTAVO",
    "9": "NOVENO",
    "10": "DECIMO",
    "11": "ONCE",
    "transicion": "TRANSICION",
    "transición": "TRANSICION"
}

def clean_text(text):
    """
    Limpia espacios en blanco dobles y saltos de línea innecesarios.
    """
    if not text:
        return ""
    text = text.replace('\n', ' ').strip()
    return re.sub(r'\s+', ' ', text)

def sort_spans_visually(spans_list):
    """
    Ordena una lista de spans agrupándolos en líneas con base en una tolerancia vertical.
    Cada línea se ordena de izquierda a derecha.
    """
    if not spans_list:
        return []
    spans_list.sort(key=lambda s: s['bbox'][1])
    
    lines = []
    current_line = []
    current_y = None
    
    for s in spans_list:
        y = s['bbox'][1]
        if current_y is None:
            current_y = y
            current_line.append(s)
        elif abs(y - current_y) <= 5.0:
            current_line.append(s)
        else:
            current_line.sort(key=lambda s: s['bbox'][0])
            lines.append(current_line)
            current_line = [s]
            current_y = y
            
    if current_line:
        current_line.sort(key=lambda s: s['bbox'][0])
        lines.append(current_line)
        
    sorted_spans = []
    for line in lines:
        sorted_spans.extend(line)
    return sorted_spans

def parse_pdf(pdf_path, start_page, area_default="Ciencias Naturales", version_default="2016"):
    """
    Parsea el PDF y extrae una lista de DBAs con sus evidencias y grado.
    """
    doc = fitz.open(pdf_path)
    dbas = []
    is_english = "ingl" in area_default.lower() or "ingl" in pdf_path.lower()
    
    def get_rgb(color_int):
        r = (color_int >> 16) & 255
        g = (color_int >> 8) & 255
        b = color_int & 255
        return r, g, b

    def is_dark_color(color_int):
        r, g, b = get_rgb(color_int)
        limit = 150 if current_grade == "TRANSICION" else 100
        return r < limit and g < limit and b < limit

    def is_white_or_light_gray(color_int):
        r, g, b = get_rgb(color_int)
        return r > 240 and g > 240 and b > 240

    def parse_grade_from_text(text):
        if re.search(r"transici[oó]n", text, re.IGNORECASE):
            return "TRANSICION"
        match = re.search(r"Grado\s+(\d+)", text, re.IGNORECASE)
        if match:
            return GRADE_MAP.get(match.group(1))
        return None

    current_grade = "TRANSICION" if ("transic" in pdf_path.lower() or "integral" in area_default.lower()) else "PRIMERO"
    
    # Detectar el color del tema dinámicamente escaneando las páginas a partir de start_page
    theme_color = None
    for page_num in range(start_page - 1, len(doc)):
        page = doc[page_num]
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block.get("type") == 0:
                for line in block["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip().lower()
                        if "evidencias de aprendizaje" in text and not is_dark_color(span["color"]):
                            theme_color = span["color"]
                            break
                if theme_color:
                    break
        if theme_color:
            break
            
    if not theme_color:
        theme_color = 16702795  # Fallback default (#FECD4B)
        
    BULLET_CHARS = {'•', '▪', '■', '●', '○', '♦', '❖', '➔', '➢', '✓', '-', 'q', '❑'}

    for page_num in range(start_page - 1, len(doc)):
        page = doc[page_num]
        page_width = page.rect.width
        page_height = page.rect.height
        
        blocks = page.get_text("dict")["blocks"]
        spans = []
        for block in blocks:
            if block.get("type") == 0:
                for line in block["lines"]:
                    for span in line["spans"]:
                        spans.append(span)
                        
        if not spans:
            continue
            
        # Detectar el grado en esta página buscando en los spans superiores
        top_spans = [s for s in spans if s['bbox'][1] < 150]
        for s in top_spans:
            detected = parse_grade_from_text(s['text'])
            if detected:
                current_grade = detected
                break
                
        # Filtrar cabeceras y pies de página (y < 100 o y > page_height - 50)
        content_spans = [s for s in spans if 100 <= s['bbox'][1] <= page_height - 50]
        
        # Dividir por columnas (izquierda/derecha)
        left_spans = []
        right_spans = []
        mid_x = page_width / 2
        
        for s in content_spans:
            center_x = (s['bbox'][0] + s['bbox'][2]) / 2
            if center_x < mid_x:
                left_spans.append(s)
            else:
                right_spans.append(s)
                
        # Ordenar visualmente cada columna
        left_spans = sort_spans_visually(left_spans)
        right_spans = sort_spans_visually(right_spans)
        
        for col_idx, col_spans in enumerate([left_spans, right_spans]):
            if not col_spans:
                continue
                
            state = "LOOKING_FOR_DBA"
            current_dba = None
            current_evidence = ""
            
            i = 0
            while i < len(col_spans):
                span = col_spans[i]
                text = span["text"].strip()
                color = span["color"]
                font = span["font"].lower()
                
                if not text:
                    i += 1
                    continue
                    
                # Evidencias de aprendizaje en color de tema
                if "evidencias de aprendizaje" in text.lower() and (color == theme_color or not is_dark_color(color)):
                    if current_dba:
                        state = "READING_EVIDENCIAS"
                    i += 1
                    continue
                    
                # Ejemplo/Ejemplos en color de tema
                if "ejemplo" in text.lower() and (color == theme_color or not is_dark_color(color)):
                    if current_dba:
                        if current_evidence:
                            current_dba["evidencias"].append(clean_text(current_evidence))
                            current_evidence = ""
                        dbas.append(current_dba)
                        current_dba = None
                    state = "LOOKING_FOR_DBA"
                    i += 1
                    continue
                    
                is_num = re.match(r"^(\d+)\.?$", text)
                is_dba_number_format = False
                if is_num:
                    dba_num = int(is_num.group(1))
                    if dba_num <= 100:
                        is_theme_color = (color == theme_color or not is_dark_color(color)) and (not is_white_or_light_gray(color) or current_grade == "TRANSICION")
                        is_english_num = is_english and (color == 5790043 or "condensed" in font)
                        if is_theme_color or is_english_num:
                            is_dba_number_format = True

                if is_dba_number_format:
                    if current_dba:
                        if current_evidence:
                            current_dba["evidencias"].append(clean_text(current_evidence))
                            current_evidence = ""
                        dbas.append(current_dba)
                    current_dba = {
                        "numero_dba": dba_num,
                        "enunciado": "",
                        "evidencias": [],
                        "grado": current_grade,
                        "area": area_default,
                        "version": version_default
                    }
                    state = "READING_ENUNCIADO"
                    i += 1
                    continue

                if state == "LOOKING_FOR_DBA":
                    i += 1
                    continue
                    
                elif state == "READING_ENUNCIADO":
                    is_theme_color = (color == theme_color or not is_dark_color(color)) and not is_white_or_light_gray(color)
                    if is_theme_color:
                        if current_dba["enunciado"]:
                            current_dba["enunciado"] += " " + text
                        else:
                            current_dba["enunciado"] = text
                    i += 1
                    
                elif state == "READING_EVIDENCIAS":
                    is_bullet = False
                    text_content = text
                    
                    if "wingdings" in font or "symbol" in font or "dingbats" in font or text in BULLET_CHARS:
                        is_bullet = True
                        text_content = ""
                    else:
                        for b in BULLET_CHARS:
                            if text.startswith(b):
                                if len(text) == len(b) or text[len(b)].isspace():
                                    is_bullet = True
                                    text_content = text[len(b):].strip()
                                    break
                                    
                    if is_bullet:
                        if current_evidence:
                            current_dba["evidencias"].append(clean_text(current_evidence))
                        current_evidence = text_content
                    else:
                        if is_dark_color(color):
                            if current_evidence:
                                current_evidence += " " + text_content
                            else:
                                current_evidence = text_content
                    i += 1

            if current_dba:
                if current_evidence:
                    current_dba["evidencias"].append(clean_text(current_evidence))
                dbas.append(current_dba)
                
    return dbas

def main():
    parser = argparse.ArgumentParser(description="Importador masivo de DBA desde PDF oficial")
    parser.add_argument("--pdf", required=True, help="Ruta al archivo PDF de los DBA")
    parser.add_argument("--area", default="Ciencias Naturales", help="Área académica a asignar")
    parser.add_argument("--version", default="2016", help="Versión curricular (ej. 2016)")
    parser.add_argument("--start-page", type=int, help="Página donde comienzan los DBA (1-indexed)")
    parser.add_argument("--db-host", default="localhost", help="Host de la BD")
    parser.add_argument("--db-port", default="5432", help="Puerto de la BD")
    parser.add_argument("--db-name", default="AcademiaNeiva", help="Nombre de la BD")
    parser.add_argument("--db-user", default="postgres", help="Usuario de la BD")
    parser.add_argument("--db-password", default="postgres", help="Contraseña de la BD")
    
    args = parser.parse_args()

    # Cargar variables de entorno si existe .env en el directorio actual o backend
    load_dotenv()
    db_host = os.environ.get("DB_HOST", args.db_host)
    db_port = os.environ.get("DB_PORT", args.db_port)
    db_name = os.environ.get("DB_NAME", args.db_name)
    db_user = os.environ.get("DB_USER", args.db_user)
    db_password = os.environ.get("DB_PASSWORD", args.db_password)

    print(f"Cargando PDF: {args.pdf}")
    if not os.path.exists(args.pdf):
        print(f"Error: El archivo PDF '{args.pdf}' no existe.")
        sys.exit(1)

    start_page = args.start_page
    if not start_page:
        try:
            start_page_str = input("Ingrese el número de página donde comienzan los DBA (ej. 8): ").strip()
            start_page = int(start_page_str)
        except Exception:
            print("Página inválida o no provista. Usando página inicial por defecto (8).")
            start_page = 8

    print(f"Parseando PDF desde la página {start_page}...")
    dbas = parse_pdf(args.pdf, start_page, args.area, args.version)
    print(f"Se extrajeron {len(dbas)} registros de DBA del PDF.")

    if not dbas:
        print("No se encontraron registros de DBA válidos para importar.")
        sys.exit(0)

    # Conectar a la base de datos
    print(f"Conectando a la base de datos '{db_name}' en {db_host}:{db_port}...")
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password
        )
        cur = conn.cursor()
        
        dbas_insertados = 0
        evidencias_insertadas = 0
        duplicados_omitidos = 0

        for dba in dbas:
            # Validar e insertar DBA
            try:
                # Comprobar duplicado
                cur.execute(
                    """SELECT id_dba FROM dba 
                       WHERE area = %s AND grado = %s AND numero_dba = %s AND version_curricular = %s""",
                    (dba["area"], dba["grado"], dba["numero_dba"], dba["version"])
                )
                exists = cur.fetchone()
                
                if exists:
                    duplicados_omitidos += 1
                    id_dba = exists[0]
                    # Actualizar el enunciado por si cambió
                    cur.execute(
                        "UPDATE dba SET enunciado = %s, updated_at = NOW() WHERE id_dba = %s",
                        (dba["enunciado"], id_dba)
                    )
                else:
                    cur.execute(
                        """INSERT INTO dba (area, grado, numero_dba, enunciado, version_curricular, estado, created_at, updated_at)
                           VALUES (%s, %s, %s, %s, %s, 'ACTIVO', NOW(), NOW())
                           RETURNING id_dba""",
                        (dba["area"], dba["grado"], dba["numero_dba"], dba["enunciado"], dba["version"])
                    )
                    id_dba = cur.fetchone()[0]
                    dbas_insertados += 1

                # Eliminar evidencias viejas e insertar las nuevas (para mantener sincronía limpia si se actualiza)
                cur.execute("DELETE FROM evidencias_dba WHERE id_dba = %s", (id_dba,))
                
                for idx, ev in enumerate(dba["evidencias"]):
                    cur.execute(
                        """INSERT INTO evidencias_dba (id_dba, descripcion, orden, estado, created_at)
                           VALUES (%s, %s, %s, 'ACTIVO', NOW())""",
                        (id_dba, ev, idx + 1)
                    )
                    evidencias_insertadas += 1

            except Exception as e:
                print(f"Error procesando DBA #{dba['numero_dba']} para {dba['grado']}: {e}")
                conn.rollback()
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        print("\n================ RESUMEN DE IMPORTACIÓN ================")
        print(f"DBAs creados nuevos:         {dbas_insertados}")
        print(f"DBAs existentes actualizados: {duplicados_omitidos}")
        print(f"Evidencias de DBA creadas:    {evidencias_insertadas}")
        print("========================================================")
        print("Importación completada con éxito.")

    except Exception as e:
        print(f"Error de conexión o base de datos: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
