"""
Fix Python syntax error: "parameter without a default follows parameter with a default"
in FastAPI route handlers.

The problem: Query params have defaults (= 1, = None, etc.) but Depends params don't,
and Depends params come AFTER Query params in some function signatures.

Solution: Add = None to all Annotated[T, Depends(fn)] params that don't already have a default.
FastAPI ignores this None default for Depends parameters.
"""
import re
import pathlib

files = list(pathlib.Path('app/api/v1').glob('*.py'))


def fix_line(line):
    """Add = None to any Annotated[..., Depends(...)] parameter line that lacks a default."""
    stripped = line.rstrip()
    # The pattern: leading whitespace, identifier, colon, Annotated[..., Depends(...)], optional trailing comma
    # Depends param line ends with ] or ],  (no = after the ])
    # We detect it by checking if the line contains Depends( and ends with ] or ],
    if 'Depends(' in line and 'Annotated[' in line:
        # Check if there's no = sign in the parameter value part (after the : type annotation)
        # Extract the part after the paramname: 
        m = re.match(r'^(\s+\w+:\s*)(Annotated\[.+\])(,?\s*)$', stripped)
        if m:
            annotation = m.group(2)
            if 'Depends(' in annotation and '=' not in m.group(1)[m.group(1).find(':'):]:
                # No = found - add = None before the trailing comma
                return m.group(1) + annotation + ' = None' + m.group(3) + (line[len(stripped):]  if len(line) > len(stripped) else '')
    return line


for f in files:
    text = f.read_text(encoding='utf-8')
    new_lines = [fix_line(line) for line in text.split('\n')]
    new = '\n'.join(new_lines)
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Fixed: {f}')

print('Done')
