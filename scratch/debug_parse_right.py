import fitz
import re

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

# Let's inspect page 8 (index 7), right column
page = doc[7]
blocks = page.get_text("dict")["blocks"]
spans = []
for block in blocks:
    if block.get("type") == 0:
        for line in block["lines"]:
            for span in line["spans"]:
                spans.append(span)

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

content_spans = [s for s in spans if 100 <= s['bbox'][1] <= page.rect.height - 50]
right_spans = [s for s in content_spans if (s['bbox'][0] + s['bbox'][2])/2 >= page.rect.width / 2]
right_spans = sort_spans_visually(right_spans)

BULLET_CHARS = {'•', '▪', '■', '●', '○', '♦', '❖', '➔', '➢', '✓', '-', 'q', '❑'}
theme_color = 16702795

state = "LOOKING_FOR_DBA"
current_dba = None
current_evidence = ""

for idx, span in enumerate(right_spans):
    text = span["text"].strip()
    color = span["color"]
    font = span["font"].lower()
    if not text:
        continue
        
    print(f"Span {idx}: text='{text}', font='{span['font']}', color=#{color:06X}, bbox={[round(x,1) for x in span['bbox']]}")
    
    if "evidencias de aprendizaje" in text.lower():
        state = "READING_EVIDENCIAS"
        print(f" -> STATE: READING_EVIDENCIAS")
        continue
        
    if "ejemplo" in text.lower():
        if current_dba:
            if current_evidence:
                print(f"   Saving completed evidence: '{current_evidence}'")
                current_dba["evidencias"].append(current_evidence)
                current_evidence = ""
            print(f"   Flushing DBA: {current_dba}")
        state = "LOOKING_FOR_DBA"
        print(f" -> STATE: LOOKING_FOR_DBA")
        continue
        
    if state == "LOOKING_FOR_DBA":
        is_num = re.match(r"^(\d+)\.?$", text)
        if is_num:
            current_dba = {
                "numero_dba": int(is_num.group(1)),
                "enunciado": "",
                "evidencias": []
            }
            state = "READING_ENUNCIADO"
            print(f" -> STATE: READING_ENUNCIADO")
            
    elif state == "READING_ENUNCIADO":
        if current_dba["enunciado"]:
            current_dba["enunciado"] += " " + text
        else:
            current_dba["enunciado"] = text
            
    elif state == "READING_EVIDENCIAS":
        is_bullet = False
        text_content = text
        
        if "wingdings" in font or "symbol" in font or "dingbats" in font or text in BULLET_CHARS:
            is_bullet = True
            text_content = ""
            print("   [BULLET DETECTED by font]")
        else:
            for b in BULLET_CHARS:
                if text.startswith(b):
                    if len(text) == len(b) or text[len(b)].isspace():
                        is_bullet = True
                        text_content = text[len(b):].strip()
                        print(f"   [BULLET DETECTED by startswith '{b}']")
                        break
                        
        if is_bullet:
            if current_evidence:
                print(f"   Saving completed evidence: '{current_evidence}'")
                current_dba["evidencias"].append(current_evidence)
            current_evidence = text_content
            print(f"   Started new evidence with: '{current_evidence}'")
        else:
            r, g, b = (color >> 16) & 255, (color >> 8) & 255, color & 255
            is_dark = r < 100 and g < 100 and b < 100
            if is_dark:
                if current_evidence:
                    current_evidence += " " + text_content
                    print(f"   Appended to current_evidence: '{current_evidence}'")
                else:
                    current_evidence = text_content
                    print(f"   Initialized current_evidence with: '{current_evidence}'")
            else:
                print(f"   Skipped non-dark span in READING_EVIDENCIAS: #{color:06X}")
