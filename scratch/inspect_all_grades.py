import fitz
import re

pdf_path = r'c:\Users\alejo\Downloads\segundoProyecto\guides\DBA\dba_c.naturales-min.pdf'
doc = fitz.open(pdf_path)

print(f"Total pages in document: {len(doc)}")

for page_num in range(len(doc)):
    page = doc[page_num]
    blocks = page.get_text("dict")["blocks"]
    spans = []
    for block in blocks:
        if block.get("type") == 0:
            for line in block["lines"]:
                for span in line["spans"]:
                    spans.append(span)
    spans.sort(key=lambda s: (s['bbox'][1], s['bbox'][0]))
    
    # Let's find spans at the very top (y < 100) that might contain the grade info
    header_spans = [s for s in spans if s['bbox'][1] < 100]
    header_text = " | ".join([s['text'].strip() for s in header_spans if s['text'].strip()])
    print(f"Page {page_num + 1}: {header_text[:120]}")
