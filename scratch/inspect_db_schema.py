with open(r'c:\Users\alejo\Downloads\segundoProyecto\guides\AcademiaNeivaBD.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Total lines:", len(lines))
for idx, line in enumerate(lines):
    if 'CREATE TABLE' in line:
        print(f"Line {idx+1}: {line.strip()}")
    if 'dba' in line.lower() or 'evidencia' in line.lower():
        print(f"Match Line {idx+1}: {line.strip()}")
