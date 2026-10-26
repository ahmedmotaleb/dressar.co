"""Copy Dressar's own strings (the `dressar.*` keys) from locales/en.default.json
into every other storefront locale file that lacks them, so Theme Check's
MatchingTranslations stays clean. Arabic is maintained by hand and skipped.
The other languages are not published, and Shopify shows the default
language's text for a missing key anyway, so this changes nothing visible.

Python rather than Node: it keeps key order exactly (Node moves keys such as
"404" to the front), so only the added lines show up in a diff.

usage: python3 tests/sync_locales.py [themeRoot]
"""
import copy
import json
import os
import re
import sys

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
folder = os.path.join(root, 'locales')
HEADER = re.compile(r'^\s*/\*.*?\*/\s*', re.S)


def read(path):
    raw = open(path, encoding='utf-8').read()
    match = HEADER.match(raw)
    header = match.group(0) if match else ''
    return header, json.loads(raw[len(header):])


def fill(target, source):
    added = 0
    for key, value in source.items():
        if key not in target:
            target[key] = copy.deepcopy(value)
            added += 1
        elif isinstance(value, dict) and isinstance(target[key], dict):
            added += fill(target[key], value)
    return added


source = read(os.path.join(folder, 'en.default.json'))[1]['dressar']
for name in sorted(os.listdir(folder)):
    if not name.endswith('.json') or name.endswith('.schema.json') or name in ('en.default.json', 'ar.json'):
        continue
    path = os.path.join(folder, name)
    header, data = read(path)
    added = fill(data.setdefault('dressar', {}), source)
    if added:
        with open(path, 'w', encoding='utf-8') as out:
            out.write(header + json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print(f'{name}: {added} added')
