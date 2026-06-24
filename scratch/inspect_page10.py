import fitz

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

# Let's inspect page 10 (0-indexed index 9)
page = doc[9]
print("=== PAGE 10 SPANS ===")
blocks = page.get_text("dict")["blocks"]
spans = []
for block in blocks:
    if block.get("type") == 0:
        for line in block["lines"]:
            for span in line["spans"]:
                spans.append(span)

# Sort by Y, then X
spans.sort(key=lambda s: (s['bbox'][1], s['bbox'][0]))

for idx, span in enumerate(spans[:30]):
    color_hex = f"#{span['color']:06X}" if 'color' in span else 'N/A'
    print(f"  {idx}: text='{span['text']}', font='{span['font']}', size={span['size']:.1f}, color={color_hex}, bbox={[round(x,1) for x in span['bbox']]}")
