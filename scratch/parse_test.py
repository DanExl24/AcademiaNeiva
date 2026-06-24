import fitz
import re

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

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
    "11": "ONCE"
}

def get_rgb(color_int):
    r = (color_int >> 16) & 255
    g = (color_int >> 8) & 255
    b = color_int & 255
    return r, g, b

def is_dark_color(color_int):
    r, g, b = get_rgb(color_int)
    return r < 100 and g < 100 and b < 100

def is_white_or_light_gray(color_int):
    r, g, b = get_rgb(color_int)
    return r > 240 and g > 240 and b > 240

def parse_grade_from_text(text):
    match = re.search(r"Grado\s+(\d+)", text, re.IGNORECASE)
    if match:
        return GRADE_MAP.get(match.group(1))
    return None

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

start_page = 8
dbas = []
current_grade = "PRIMERO"

# Detect theme color starting from start_page and ensuring it is not a dark color
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

print(f"Detected theme color: #{theme_color:06X}" if theme_color else "Theme color not detected")
if not theme_color:
    theme_color = 16702795 # Default fallback

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
        
    # Detect grade on this page
    top_spans = [s for s in spans if s['bbox'][1] < 100]
    for s in top_spans:
        detected = parse_grade_from_text(s['text'])
        if detected:
            current_grade = detected
            break
            
    # Filter out header and footer spans
    content_spans = [s for s in spans if 100 <= s['bbox'][1] <= page_height - 50]
    
    # Split into columns based on x coordinate center
    left_spans = []
    right_spans = []
    mid_x = page_width / 2
    
    for s in content_spans:
        center_x = (s['bbox'][0] + s['bbox'][2]) / 2
        if center_x < mid_x:
            left_spans.append(s)
        else:
            right_spans.append(s)
            
    # Visually sort columns
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
                
            # If text matches "evidencias de aprendizaje" in theme color
            if "evidencias de aprendizaje" in text.lower() and (color == theme_color or not is_dark_color(color)):
                if current_dba:
                    state = "READING_EVIDENCIAS"
                i += 1
                continue
                
            # If text matches "ejemplo" or "ejemplos" in theme color
            if "ejemplo" in text.lower() and (color == theme_color or not is_dark_color(color)):
                if current_dba:
                    if current_evidence:
                        current_dba["evidencias"].append(current_evidence.strip())
                        current_evidence = ""
                    dbas.append(current_dba)
                    current_dba = None
                state = "LOOKING_FOR_DBA"
                i += 1
                continue
                
            if state == "LOOKING_FOR_DBA":
                is_num = re.match(r"^(\d+)\.?$", text)
                is_theme_color = (color == theme_color or not is_dark_color(color)) and not is_white_or_light_gray(color)
                
                if is_num and is_theme_color:
                    dba_num = int(is_num.group(1))
                    current_dba = {
                        "numero_dba": dba_num,
                        "enunciado": "",
                        "evidencias": [],
                        "grado": current_grade,
                        "page": page_num + 1,
                        "column": "Left" if col_idx == 0 else "Right"
                    }
                    state = "READING_ENUNCIADO"
                i += 1
                
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
                        current_dba["evidencias"].append(current_evidence.strip())
                    current_evidence = text_content
                else:
                    if is_dark_color(color):
                        if current_evidence:
                            current_evidence += " " + text_content
                        else:
                            current_evidence = text_content
                i += 1

        # If column ended and we are still reading, flush
        if current_dba:
            if current_evidence:
                current_dba["evidencias"].append(current_evidence.strip())
            dbas.append(current_dba)

print(f"\nParsed {len(dbas)} DBAs:")
for d in dbas[:10]:
    print(f"Page {d['page']} ({d['column']}) | Grado: {d['grado']} | DBA #{d['numero_dba']}")
    print(f"  Enunciado: {d['enunciado']}")
    print(f"  Evidencias ({len(d['evidencias'])}):")
    for ev in d['evidencias']:
        print(f"    - {ev}")
    print("-" * 80)
