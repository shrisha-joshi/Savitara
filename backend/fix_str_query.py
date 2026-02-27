import re
import pathlib

files = list(pathlib.Path('app/api/v1').glob('*.py'))
for f in files:
    text = f.read_text(encoding='utf-8')
    # Fix: Annotated[str, Query("default", rest...)]  -> Annotated[str, Query(rest)] = "default"
    new = re.sub(
        r'Annotated\[str,\s*Query\("([^"]+)",\s*(.*?)\)\]',
        lambda m: f'Annotated[str, Query({m.group(2)})] = "{m.group(1)}"',
        text
    )
    # Also: Annotated[str, Query("default")] (no extra args)
    new = re.sub(
        r'Annotated\[str,\s*Query\("([^"]+)"\)\]',
        lambda m: f'Annotated[str, Query()] = "{m.group(1)}"',
        new
    )
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Fixed str: {f}')

print('done')
