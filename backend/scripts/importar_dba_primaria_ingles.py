import fitz  # PyMuPDF
import psycopg2
from psycopg2.extras import execute_values
import re
import os
import argparse
import sys
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Mapeo de grados del MEN a los valores del sistema
GRADE_MAP = {
    "1": "PRIMERO",
    "2": "SEGUNDO",
    "3": "TERCERO",
    "4": "CUARTO",
    "5": "QUINTO",
    "transicion": "TRANSICION",
    "transición": "TRANSICION"
}

def clean_text(text):
    if not text:
        return ""
    text = text.replace('\n', ' ').strip()
    return re.sub(r'\s+', ' ', text)

def sort_spans_visually(spans_list):
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
        elif abs(y - current_y) <= 4.0:
            current_line.append(s)
        else:
            current_line.sort(key=lambda s: s['bbox'][0])
            lines.append((current_y, current_line))
            current_line = [s]
            current_y = y
    if current_line:
        current_line.sort(key=lambda s: s['bbox'][0])
        lines.append((current_y, current_line))
    return lines

def parse_pdf(pdf_path, start_page, area, version):
    doc = fitz.open(pdf_path)
    dbas = []
    
    # El PDF de transición y primaria de inglés tiene las páginas de DBA desde start_page a start_page + 5
    # (ej. de página 8 a 13, que corresponde a los índices 7 a 12 si start_page = 8)
    for page_offset in range(6):
        page_idx = (start_page - 1) + page_offset
        if page_idx >= len(doc):
            break
            
        page = doc[page_idx]
        page_width = page.rect.width
        
        # Extraer spans de texto
        blocks = page.get_text("dict")["blocks"]
        spans = []
        for b in blocks:
            if b.get("type") == 0:
                for line in b["lines"]:
                    spans.extend(line["spans"])
                    
        # 1. Detectar Grado en la página
        current_grade = None
        for s in spans:
            text = s["text"].strip()
            # El círculo del grado es texto blanco con fuente ArialRounded
            if s["color"] == 16777215 and "arialrounded" in s["font"].lower():
                if text == "Tr":
                    current_grade = "TRANSICION"
                elif text in ["1", "2", "3", "4", "5"]:
                    grade_map_local = {"1": "PRIMERO", "2": "SEGUNDO", "3": "TERCERO", "4": "CUARTO", "5": "QUINTO"}
                    current_grade = grade_map_local.get(text)
                break
                
        if not current_grade:
            # Fallback seguro basado en el índice relativo
            fallback_map = {0: "TRANSICION", 1: "PRIMERO", 2: "SEGUNDO", 3: "TERCERO", 4: "CUARTO", 5: "QUINTO"}
            current_grade = fallback_map.get(page_offset, "PRIMERO")
            
        # 2. Particionar la página en los 5 slots posibles de DBAs reales
        # Slot 1: Columna 1 superior (x < 300, y < 355) -> DBA 1
        # Slot 2: Columna 2 superior (300 <= x < 600, y < 355) -> DBA 2
        # Slot 3: Columna 1 inferior (x < 300, y >= 355) -> DBA 3
        # Slot 4: Columna 2 inferior (300 <= x < 600, y >= 355) -> DBA 4
        # Slot 5: Columna 3 superior (600 <= x < 920, y < 320) -> DBA 5 (sólo Primero, Tercero y Quinto)
        sections = {1: [], 2: [], 3: [], 4: [], 5: []}
        
        for s in spans:
            text = s["text"].strip()
            if not text:
                continue
            x = s["bbox"][0]
            y = s["bbox"][1]
            
            # Omitir pies de página, títulos de cabecera y el margen del grado
            if y < 60 or y > page.rect.height - 40:
                continue
            if x > page_width - 60:
                continue
            if "finalizar este" in text.lower() or "estudiante:" in text.lower():
                continue
                
            # Determinar columna
            if x < 300:
                col = 1
            elif x < 600:
                col = 2
            elif x < 920:
                col = 3
            else:
                col = 4
                
            # Determinar verticalidad (arriba/abajo)
            if col in [1, 2]:
                is_top = (y < 355)
            else:
                is_top = (y < 320)
                
            # Asignar a slot
            if col == 1:
                dba_num = 1 if is_top else 3
            elif col == 2:
                dba_num = 2 if is_top else 4
            elif col == 3 and is_top and current_grade in ["PRIMERO", "TERCERO", "QUINTO"]:
                dba_num = 5
            else:
                continue
                
            sections[dba_num].append(s)
            
        # 3. Procesar y limpiar cada slot
        for dba_num in [1, 2, 3, 4, 5]:
            sec_spans = sections[dba_num]
            if not sec_spans:
                continue
                
            # Validar que contenga texto destacado (enunciado con color de tema)
            has_theme_color = False
            for s in sec_spans:
                color = s["color"]
                font = s["font"].lower()
                if color != 0 and color != 16777215 and ("alternate" in font or "bold" in font or "din" in font):
                    if s["bbox"][0] < page_width - 80:
                        has_theme_color = True
                        break
            if not has_theme_color:
                continue
                
            # Filtrar números sueltos y textos decorativos
            filtered_spans = []
            grade_names_filter = ["tr", "transicion", "transición", "primero", "segundo", "tercero", "cuarto", "quinto"]
            for s in sec_spans:
                t = s["text"].strip()
                if re.match(r"^\d+$", t) or s["bbox"][0] > page_width - 80:
                    continue
                if t.lower() in grade_names_filter:
                    continue
                if "finalizar este" in t.lower() or "estudiante:" in t.lower():
                    continue
                filtered_spans.append(s)
                
            if not filtered_spans:
                continue
                
            # Agrupar en líneas visuales
            lines = sort_spans_visually(filtered_spans)
            
            # Filtrar líneas por margen de alineación de columna
            valid_lines = []
            for y_coord, line_spans in lines:
                if not line_spans:
                    continue
                start_x = line_spans[0]["bbox"][0]
                
                if dba_num in [1, 3]:
                    is_aligned = (start_x < 150)
                elif dba_num in [2, 4]:
                    is_aligned = (340 <= start_x < 420)
                elif dba_num == 5:
                    is_aligned = (700 <= start_x < 780)
                else:
                    is_aligned = False
                    
                if is_aligned:
                    valid_lines.append((y_coord, line_spans))
                    
            # Encontrar la primera línea con color destacado
            first_theme_idx = -1
            for idx, (y_coord, line_spans) in enumerate(valid_lines):
                has_color = False
                for s in line_spans:
                    color = s["color"]
                    font = s["font"].lower()
                    if color != 0 and color != 16777215 and ("alternate" in font or "bold" in font or "din" in font):
                        has_color = True
                        break
                if has_color:
                    first_theme_idx = idx
                    break
                    
            if first_theme_idx == -1:
                continue
                
            valid_lines = valid_lines[first_theme_idx:]
            
            # Reconstruir enunciado usando límites verticales (gap > 22px) y horizontales (gap > 20px)
            enunciado_spans = []
            prev_y = None
            for y_coord, line_spans in valid_lines:
                if prev_y is not None:
                    if (y_coord - prev_y) > 22:
                        break
                
                prev_x2 = None
                for s in line_spans:
                    x1 = s["bbox"][0]
                    x2 = s["bbox"][2]
                    if prev_x2 is not None:
                        if (x1 - prev_x2) > 20:
                            break
                    enunciado_spans.append(s)
                    prev_x2 = x2
                    
                prev_y = y_coord
                
            text_parts = [s["text"].strip() for s in enunciado_spans]
            full_text = " ".join(text_parts)
            full_text = clean_text(full_text)
            
            # Quitar Tr / tr sobrante
            full_text = re.sub(r"^(Tr|tr)\s+", "", full_text)
            
            if not full_text or len(re.sub(r"[_\-\s\.]", "", full_text)) < 5:
                continue
                
            # Cortar en introducciones de ejemplo
            match = re.search(r"(.*?ejemplo:?|.*?ejemplos:?|.*?ejemplo\s+como:?)", full_text, re.IGNORECASE)
            if match:
                enunciado = match.group(1).strip()
            else:
                enunciado = full_text
                
            # Limpiar conectores de ejemplos del final
            enunciado = re.sub(r"[,;\s]+(Por\s+)?ejemplo:?$", "", enunciado, flags=re.IGNORECASE)
            enunciado = re.sub(r"[,;\s]+tal\s+como\s+se\s+muestra\s+en\s+el\s+siguiente\s+ejemplo:?$", "", enunciado, flags=re.IGNORECASE)
            enunciado = re.sub(r"[,;\s]+como\s+muestra\s+el\s+siguiente\s+ejemplo:?$", "", enunciado, flags=re.IGNORECASE)
            enunciado = re.sub(r"[,;\s]+como\s+en\s+el\s+siguiente\s+ejemplo:?$", "", enunciado, flags=re.IGNORECASE)
            enunciado = re.sub(r"[,;\s]+así\s+como\s+se\s+muestra\s+en\s+el\s+siguiente\s+ejemplo:?$", "", enunciado, flags=re.IGNORECASE)
            enunciado = re.sub(r"[,;\s]+siempre\s+que\s+el\s+tema\s+le\s+sea\s+conocido;?\s+como\s+se\s+muestra\s+en\s+el\s+siguiente\s+ejemplo:?$", "", enunciado, flags=re.IGNORECASE)
            
            connector_words = {"como", "tal", "se", "muestra", "en", "el", "siguiente", "puede", "de", "esta", "forma", "manera", "al", "a", "ellas", "así", "asi"}
            while True:
                words = enunciado.split()
                if not words:
                    break
                last_word = re.sub(r"[^\w]", "", words[-1]).lower()
                if last_word in connector_words:
                    enunciado = " ".join(words[:-1])
                else:
                    break
                    
            enunciado = re.sub(r"[,;\s\.]+$", "", enunciado)
            
            dbas.append({
                "numero_dba": dba_num,
                "grado": current_grade,
                "enunciado": enunciado,
                "area": area,
                "version": version,
                "evidencias": []  # El PDF de primaria de inglés no lista evidencias numeradas
            })
            
    return dbas

def main():
    parser = argparse.ArgumentParser(description="Importador de DBA de Inglés Transición y Primaria")
    parser.add_argument("--pdf", required=True, help="Ruta al archivo PDF")
    parser.add_argument("--area", default="Ingles", help="Área académica")
    parser.add_argument("--version", default="2016", help="Versión curricular")
    parser.add_argument("--start-page", type=int, default=8, help="Página física de inicio")
    parser.add_argument("--db-host", default="localhost")
    parser.add_argument("--db-port", default="5432")
    parser.add_argument("--db-name", default="AcademiaNeiva")
    parser.add_argument("--db-user", default="postgres")
    parser.add_argument("--db-password", default="postgres")
    
    args = parser.parse_args()
    try:
        load_dotenv()
    except NameError:
        pass
    
    db_host = os.environ.get("DB_HOST", args.db_host)
    db_port = os.environ.get("DB_PORT", args.db_port)
    db_name = os.environ.get("DB_NAME", args.db_name)
    db_user = os.environ.get("DB_USER", args.db_user)
    db_password = os.environ.get("DB_PASSWORD", args.db_password)
    
    print(f"Cargando PDF: {args.pdf}")
    if not os.path.exists(args.pdf):
        print(f"Error: El archivo PDF '{args.pdf}' no existe.")
        sys.exit(1)
        
    dbas = parse_pdf(args.pdf, args.start_page, args.area, args.version)
    print(f"Se extrajeron {len(dbas)} registros de DBA del PDF.")
    
    if not dbas:
        print("No se encontraron registros de DBA válidos para importar.")
        sys.exit(0)
        
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
            try:
                cur.execute("SAVEPOINT sp_dba")
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
                    
                # Limpiar evidencias viejas si las hay
                cur.execute("DELETE FROM evidencias_dba WHERE id_dba = %s", (id_dba,))
                cur.execute("RELEASE SAVEPOINT sp_dba")
                
            except Exception as e:
                print(f"Error procesando DBA #{dba['numero_dba']} para {dba['grado']}: {e}")
                cur.execute("ROLLBACK TO SAVEPOINT sp_dba")
                continue
                
        conn.commit()
        cur.close()
        conn.close()
        
        print("\n================ RESUMEN DE IMPORTACIÓN ================")
        print(f"DBAs creados nuevos:         {dbas_insertados}")
        print(f"DBAs existentes actualizados: {duplicados_omitidos}")
        print(f"Evidencias de DBA creadas:    0")
        print("========================================================")
        print("Importación completada con éxito.")
        
    except Exception as e:
        print(f"Error de conexión o base de datos: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
