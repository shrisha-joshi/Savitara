import re
import pathlib

files = list(pathlib.Path('app/api/v1').glob('*.py'))
for f in files:
    text = f.read_text(encoding='utf-8')
    # Fix multiline: Annotated[str, Query(\n    "default", rest\n)]
    # re.DOTALL to match across newlines
    new = re.sub(
        r'Annotated\[str,\s*Query\(\s*"([^"]+)",\s*(.*?)\)\]',
        lambda m: f'Annotated[str, Query({m.group(2).strip()})] = "{m.group(1)}"',
        text,
        flags=re.DOTALL
    )
    # Fix: Annotated[str, Query(\n   "default"\n)]
    new = re.sub(
        r'Annotated\[str,\s*Query\(\s*"([^"]+)"\s*\)\]',
        lambda m: f'Annotated[str, Query()] = "{m.group(1)}"',
        new,
        flags=re.DOTALL
    )
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Fixed: {f}')

print('done')
