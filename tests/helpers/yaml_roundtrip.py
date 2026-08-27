#!/usr/bin/env python3
'''
yaml_roundtrip.py
Helper para tests de ida y vuelta YAML (ORDEN-RONDA-12 §2.1).
Recibe un archivo YAML, lo parsea con PyYAML y devuelve JSON con
los valores parseados. Se usa desde Node con child_process.
'''
import sys
import json
import yaml

def roundtrip(archivo):
    with open(archivo, 'r', encoding='utf-8') as f:
        datos = yaml.safe_load(f)
    return json.dumps(datos, ensure_ascii=False)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.stdout.buffer.write(json.dumps({'error': 'Uso: yaml_roundtrip.py <archivo.yaml>'}).encode('utf-8'))
        sys.exit(1)
    try:
        resultado = roundtrip(sys.argv[1])
        sys.stdout.buffer.write(resultado.encode('utf-8'))
    except Exception as e:
        sys.stdout.buffer.write(json.dumps({'error': str(e)}).encode('utf-8'))
        sys.exit(1)
