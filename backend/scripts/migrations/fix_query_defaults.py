import re
import pathlib

# Fix FastAPI Query/Depends default value placement in Annotated parameters
# FastAPI >= 0.115 requires: param: Annotated[T, Query(ge=1)] = default
# NOT: param: Annotated[T, Query(default, ge=1)]
# IMPORTANT: Do NOT add = Depends(fn) — FastAPI handles Annotated[T, Depends(fn)] correctly

files = list(pathlib.Path('app/api/v1').glob('*.py'))

# Pattern: name: Annotated[int, Query(int_default, constraints...)]
pattern_int = re.compile(r'(\w+):\s*Annotated\[int,\s*Query\((\d+)(?:,\s*(.*?))?\)\]')

# Pattern: name: Annotated[bool, Query(True/False, ...)]
pattern_bool = re.compile(r'(\w+):\s*Annotated\[bool,\s*Query\((True|False)(?:,\s*(.*?))?\)\]')

# Pattern: name: Annotated[Optional[T], Query(None, optional_desc...)]
pattern_opt_none = re.compile(r'(\w+):\s*Annotated\[Optional\[(.*?)\],\s*Query\(None(?:,\s*(.*?))?\)\]')

# Revert any accidental = Depends(fn) that was added
pattern_remove_depends_default = re.compile(r'(Annotated\[[^\]]+,\s*Depends\([^)]+\)\])\s*=\s*Depends\([^)]+\)')


def fix_int(m):
    name, default, rest = m.group(1), m.group(2), m.group(3)
    if rest:
        return f'{name}: Annotated[int, Query({rest})] = {default}'
    else:
        return f'{name}: Annotated[int, Query()] = {default}'


def fix_bool(m):
    name, default, rest = m.group(1), m.group(2), m.group(3)
    if rest:
        return f'{name}: Annotated[bool, Query({rest})] = {default}'
    else:
        return f'{name}: Annotated[bool, Query()] = {default}'


def fix_opt_none(m):
    name, typ, rest = m.group(1), m.group(2), m.group(3)
    if rest:
        return f'{name}: Annotated[Optional[{typ}], Query({rest})] = None'
    else:
        return f'{name}: Annotated[Optional[{typ}], Query()] = None'


def revert_depends_default(m):
    return m.group(1)  # Just keep the Annotated[...] without the = Depends(fn)


for f in files:
    text = f.read_text(encoding='utf-8')
    new = pattern_int.sub(fix_int, text)
    new = pattern_bool.sub(fix_bool, new)
    new = pattern_opt_none.sub(fix_opt_none, new)
    # Revert the bad = Depends(fn) defaults we added in previous runs
    new = pattern_remove_depends_default.sub(revert_depends_default, new)
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Fixed: {f}')

print('Done')
