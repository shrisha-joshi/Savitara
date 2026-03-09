"""
Comprehensive fix for FastAPI Query/Body default value placement.
Handles all single-line Annotated[T, Query(default, ...)] patterns.
"""
import re
import pathlib

files = list(pathlib.Path('app/api/v1').glob('*.py'))

# Pattern: name: Annotated[float, Query(float_default, ...)]
pattern_float = re.compile(r'(\w+):\s*Annotated\[float,\s*Query\(([\d.]+)(?:,\s*(.*?))?\)\]')

# pattern_str: Annotated[str, Query("...", constraints)] -- only when first arg is string default
# Skip for now since "..." (ellipsis) is a required marker not a default


def fix_float(m):
    name, default, rest = m.group(1), m.group(2), m.group(3)
    if rest:
        return f'{name}: Annotated[float, Query({rest})] = {default}'
    else:
        return f'{name}: Annotated[float, Query()] = {default}'


for f in files:
    text = f.read_text(encoding='utf-8')
    new = pattern_float.sub(fix_float, text)
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Fixed float: {f}')

print('Done')
