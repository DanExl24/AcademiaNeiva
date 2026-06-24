import fitz

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

for page_num in range(len(doc)):
    page = doc[page_num]
    text = page.get_text()
    if "Comprende que los sentidos" in text:
        print(f"Found page index: {page_num}")
        # Get all spans
        blocks = page.get_text("dict")["blocks"]
        spans = []
        for block in blocks:
            if block.get("type") == 0:
                for line in block["lines"]:
                    for span in line["spans"]:
                        spans.append(span)
        # Sort spans by top Y (span['bbox'][1]), then left X (span['bbox'][0])
        spans.sort(key=lambda s: (s['bbox'][1], s['bbox'][0]))
        
        print("First 15 spans from top to bottom:")
        for idx, span in enumerate(spans[:15]):
            color_hex = f"#{span['color']:06X}" if 'color' in span else 'N/A'
            print(f"  {idx}: text='{span['text']}', font='{span['font']}', size={span['size']:.1f}, color={color_hex}, bbox={[round(x,1) for x in span['bbox']]}")
        break
