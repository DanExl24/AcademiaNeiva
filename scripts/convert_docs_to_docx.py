import os
import sys
import re
import base64
import urllib.request
import zlib
import subprocess
import hashlib
import time
import concurrent.futures
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCX_OUTPUT_DIR = os.path.join(BASE_DIR, "docx")
CACHE_DIR = os.path.join(os.path.dirname(__file__), ".mermaid_cache")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(DOCX_OUTPUT_DIR, exist_ok=True)

TARGET_PATHS = [
    r"guides\dic",
    r"guides\maestros",
    r"manuales_software",
    r"guides\arquitectura_y_datos\architecture.md",
    r"guides\modules",
    r"guides\normativa_y_legal",
    r"guides\reglas_negocio",
    r"guides\seguridad",
]

def render_mermaid(code: str) -> str | None:
    code_clean = code.strip()
    code_hash = hashlib.sha256(code_clean.encode("utf-8")).hexdigest()
    img_path = os.path.join(CACHE_DIR, f"{code_hash}.png")

    if os.path.exists(img_path) and os.path.getsize(img_path) > 200:
        return img_path

    # Try rendering with retries
    for attempt in range(3):
        # 1. Try kroki first (very fast and reliable)
        try:
            compressed = zlib.compress(code_clean.encode("utf-8"), 9)
            kroki_payload = base64.urlsafe_b64encode(compressed).decode("ascii")
            url = f"https://kroki.io/mermaid/png/{kroki_payload}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = resp.read()
                if len(data) > 200:
                    with open(img_path, "wb") as f:
                        f.write(data)
                    return img_path
        except Exception:
            pass

        # 2. Try mermaid.ink fallback
        try:
            graphbytes = code_clean.encode("utf8")
            base64_string = base64.b64encode(graphbytes).decode("ascii")
            url = f"https://mermaid.ink/img/{base64_string}?bgColor=!white"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = resp.read()
                if len(data) > 200:
                    with open(img_path, "wb") as f:
                        f.write(data)
                    return img_path
        except Exception:
            pass

        time.sleep(1)

    print(f"Advertencia: No se pudo renderizar diagrama {code_hash[:8]}")
    return None

def find_all_markdown_files(targets: list[str]) -> list[str]:
    md_files = []
    for t in targets:
        # Check current working directory, base directory, or absolute path
        full_p = os.path.abspath(t) if os.path.exists(t) else os.path.normpath(os.path.join(BASE_DIR, t))
        if os.path.isfile(full_p) and full_p.endswith(".md"):
            md_files.append(full_p)
        elif os.path.isdir(full_p):
            for root, _, files in os.walk(full_p):
                for f in files:
                    if f.endswith(".md"):
                        md_files.append(os.path.join(root, f))
    return sorted(list(set(md_files)))

def convert_single_file(md_path: str) -> tuple[str, bool, str]:
    rel_path = os.path.relpath(md_path, BASE_DIR)
    docx_rel = os.path.splitext(rel_path)[0] + ".docx"
    docx_path = os.path.join(DOCX_OUTPUT_DIR, docx_rel)
    
    os.makedirs(os.path.dirname(docx_path), exist_ok=True)

    try:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

        mermaid_pattern = re.compile(r"```mermaid\s*\n(.*?)\n```", re.DOTALL)
        matches = list(mermaid_pattern.finditer(content))
        
        if matches:
            def replace_match(match):
                code = match.group(1)
                img_path = render_mermaid(code)
                if img_path:
                    abs_posix = os.path.abspath(img_path).replace("\\", "/")
                    return f"\n\n![Diagrama]({abs_posix})\n\n"
                return match.group(0)

            processed_content = mermaid_pattern.sub(replace_match, content)
        else:
            processed_content = content

        temp_md = os.path.splitext(md_path)[0] + ".__temp_convert__.md"
        with open(temp_md, "w", encoding="utf-8") as f:
            f.write(processed_content)

        # Execute pandoc
        cmd = ["pandoc", temp_md, "-o", docx_path]
        res = subprocess.run(cmd, capture_output=True, text=True)

        if os.path.exists(temp_md):
            try:
                os.remove(temp_md)
            except Exception:
                pass

        if res.returncode == 0 and os.path.exists(docx_path):
            return md_path, True, f"OK -> docx/{docx_rel} ({os.path.getsize(docx_path)} bytes)"
        else:
            return md_path, False, f"Pandoc error: {res.stderr}"

    except Exception as e:
        return md_path, False, str(e)

def main():
    # Check if arguments were passed from terminal
    args = sys.argv[1:]
    targets = args if args else TARGET_PATHS

    print("Buscando archivos markdown...")
    files = find_all_markdown_files(targets)
    if not files:
        print(f"No se encontraron archivos .md en las rutas especificadas: {targets}")
        return

    print(f"Total de archivos .md a convertir: {len(files)}")
    print(f"Carpeta de destino: {DOCX_OUTPUT_DIR}\n")

    print("Iniciando conversión a .docx...")
    success_count = 0
    fail_count = 0

    # Run with workers
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(convert_single_file, f): f for f in files}
        for future in concurrent.futures.as_completed(futures):
            fpath = futures[future]
            rel_path = os.path.relpath(fpath, BASE_DIR)
            try:
                path, success, msg = future.result()
                if success:
                    success_count += 1
                    print(f"  [OK] {rel_path} -> {msg}")
                else:
                    fail_count += 1
                    print(f"  [FAIL] {rel_path} -> {msg}")
            except Exception as e:
                fail_count += 1
                print(f"  [ERROR] {rel_path} -> Excepción: {e}")

    print("\n" + "=" * 50)
    print(f"Conversión completada. Éxito: {success_count}, Fallos: {fail_count}")
    print(f"Todos los archivos .docx organizados en la carpeta: /docx")
    print("=" * 50)

if __name__ == "__main__":
    main()
