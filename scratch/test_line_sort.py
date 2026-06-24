import fitz

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

# Inspect page 8
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

# Group and sort spans
def sort_spans_visually(spans_list):
    if not spans_list:
        return []
    # 1. Sort by Y coordinate first
    spans_list.sort(key=lambda s: s['bbox'][1])
    
    # 2. Group into lines with a tolerance (e.g., 5.0 points)
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
            # Sort current line by X coordinate
            current_line.sort(key=lambda s: s['bbox'][0])
            lines.append(current_line)
            current_line = [s]
            current_y = y
            
    if current_line:
        current_line.sort(key=lambda s: s['bbox'][0])
        lines.append(current_line)
        
    # 3. Flatten lines
    sorted_spans = []
    for line in lines:
        sorted_spans.extend(line)
    return sorted_spans

sorted_left_spans = sort_spans_visually(left_spans)

print("Visually sorted left column spans:")
for idx, span in enumerate(sorted_left_spans):
    text = span["text"].strip()
    color = span["color"]
    print(f"Span {idx}: text='{text}', font='{span['font']}', color=#{color:06X}, bbox={[round(x,1) for x in span['bbox']]}")
