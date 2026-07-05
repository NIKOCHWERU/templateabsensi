import os
import re

directories = ['client/src', 'server']

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return

    # Case insensitive replacement preserving case isn't strictly requested to be perfect, 
    # but we can do simple replacements:
    # Karyawan -> Tenaga Kerja
    # karyawan -> tenaga kerja
    # KARYAWAN -> TENAGA KERJA

    new_content = content
    new_content = new_content.replace('Karyawan', 'Tenaga Kerja')
    new_content = new_content.replace('karyawan', 'tenaga kerja')
    new_content = new_content.replace('KARYAWAN', 'TENAGA KERJA')

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx') or file.endswith('.js'):
                replace_in_file(os.path.join(root, file))
