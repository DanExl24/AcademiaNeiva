import fitz
import re

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

# Let's inspect page 8 (index 7), left column
page = doc[7]
blocks = page.get_text("dict")["blocks"]
spans = []
for block in blocks:
    if block.get("type") == 0:
        for line in block["lines"]:
            for span in line["spans"]:
                spans.append(span)

content_spans = [s for s in spans if 100 <= s['bbox'][1] <= page.rect.height - 50]
left_spans = [s for s in content_spans if (s['bbox'][0] + s['bbox'][2])/2 < page.rect.width / 2]
left_spans.sort(key=lambda s: (s['bbox'][1], s['bbox'][0]))

BULLET_CHARS = {'•', '▪', '■', '●', '○', '♦', '❖', '➔', '➢', '✓', '-', 'q', '❑'}

state = "LOOKING_FOR_DBA"
current_dba = {
    "numero_dba": 1,
    "enunciado": "",
    "evidencias": []
}
current_evidence = ""

print("Processing left column spans:")
for idx, span in enumerate(left_spans):
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
        state = "LOOKING_FOR_DBA"
        print(f" -> STATE: LOOKING_FOR_DBA")
        continue
        
    if state == "READING_EVIDENCIAS":
        is_bullet = False
        text_content = text
        
        if "wingdings" in font or "symbol" in font or "dingbats" in font or text in BULLET_CHARS:
            is_bullet = True
            text_content = ""
            print(f"   [BULLET DETECTED by font/exact match]")
        else:
            for b in BULLET_CHARS:
                if text.startswith(b):
                    if len(text) == len(b) or text[len(b)].isspace():
                        is_bullet = True
                        text_content = text[len(b):].strip()
                        print(f"   [BULLET DETECTED by startswith '{b}']: remaining='{text_content}'")
                        break
                        
        if is_bullet:
            if current_evidence:
                print(f"   Saving completed evidence: '{current_evidence}'")
                current_dba["evidencias"].append(current_evidence)
            current_evidence = text_content
            print(f"   Started new evidence with: '{current_evidence}'")
        else:
            if current_evidence:
                current_evidence += " " + text_content
                print(f"   Appended to current_evidence: '{current_evidence}'")
            else:
                current_evidence = text_content
                print(f"   Initialized current_evidence with: '{current_evidence}'")
