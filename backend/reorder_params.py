"""
Move Depends() parameters before Query() parameters in FastAPI function signatures.
This fixes the Python syntax error: parameter without a default follows parameter with a default.

FastAPI handles Annotated[T, Depends(fn)] without a default value,
but Python requires non-default params to come before default params.
Solution: reorder so Depends params come first.
"""
import re
import pathlib

files = list(pathlib.Path('app/api/v1').glob('*.py'))

# Matches a complete function parameter with a trailing comma (for reordering)
# This is a simplified approach: scan function signature lines

def reorder_function_params(text):
    """Find async def functions and reorder params: Depends-only first, then Query, then Body."""
    lines = text.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Look for async def with opening parenthesis on same line or next
        if re.match(r'\s*async def ', line):
            # Collect entire function signature until we find '):'
            sig_lines = [line]
            j = i + 1
            depth = line.count('(') - line.count(')')
            while depth > 0 and j < len(lines):
                sig_lines.append(lines[j])
                depth += lines[j].count('(') - lines[j].count(')')
                j += 1

            sig = '\n'.join(sig_lines)

            # Check if there are Depends params AFTER Query-with-default params
            # Simple heuristic: find params that are Annotated[..., Depends(...)] without = 
            # and params that have = defaultvalue
            # Reorder within the function parameter block

            reordered = reorder_params_in_sig(sig)
            result.extend(reordered.split('\n'))
            i = j
            continue
        result.append(line)
        i += 1
    return '\n'.join(result)


def reorder_params_in_sig(sig):
    """Reorder parameters in a function signature so Depends-params come before Query-with-default params."""
    # Extract the parameters section (between first ( and matching ))
    # Find the parameter block
    m = re.search(r'(async def \w+\s*\()(.*?)(\)\s*(?:->.*?)?:)', sig, re.DOTALL)
    if not m:
        return sig

    prefix = m.group(1)
    params_str = m.group(2)
    suffix = m.group(3)

    # Split params by comma at depth 0
    params = split_params(params_str)
    if len(params) <= 1:
        return sig

    # Classify each param
    depends_params = []
    query_default_params = []
    other_params = []  # body params, required params without defaults

    for p in params:
        p_stripped = p.strip()
        if not p_stripped:
            continue
        if 'Depends(' in p and '= None' not in p and re.search(r'=\s*Depends', p) is None and '=' not in p.split(':')[1] if ':' in p else True:
            depends_params.append(p)
        elif re.search(r'Annotated\[', p) and '= ' in p and 'Depends(' not in p:
            query_default_params.append(p)
        elif 'Depends(' in p:
            # Has Depends but also has = default (which is wrong for FastAPI)
            depends_params.append(p)
        else:
            other_params.append(p)

    # If no reordering needed, return as-is
    has_issue = False
    seen_default = False
    for p in params:
        p_stripped = p.strip()
        if not p_stripped:
            continue
        has_eq = '=' in (p.split(':', 1)[1] if ':' in p else p)
        is_depends_no_default = 'Depends(' in p and not re.search(r'=\s*Depends', p) and '=' not in (p.split(':', 1)[1] if ':' in p else p)
        if has_eq and not is_depends_no_default:
            seen_default = True
        if is_depends_no_default and seen_default:
            has_issue = True
            break

    if not has_issue:
        return sig

    # Reorder: other (required, no default) first, then Depends (no default), then query-with-default
    # Actually FastAPI convention: first body/required, then depends, then query with default
    # But the simpler fix: put depends params AFTER query params (they're injected, not positional)
    # Python only cares about positional defaults for non-Annotated-Depends params

    # The real fix: move ALL Query-with-default BEFORE the Depends params
    # Reorder: other_params (no default), then query_default_params, then depends_params
    # Wait -- depends have no default so they must come FIRST
    # Order: required_params (no default, no depends), depends_params (no default), query_default_params (with default, required last technically)
    # Actually in Python: no-default params MUST come before default params
    # Depends params have no Python default, so they must come before Query-with-default params

    new_params = other_params + depends_params + query_default_params

    # Preserve indentation from original
    indent = '    '
    if params and params[0].strip():
        indent_m = re.match(r'^(\s+)', params[0])
        if indent_m:
            indent = indent_m.group(1)

    new_params_str = (',\n' + indent).join([p.strip() for p in new_params if p.strip()])
    if params_str.strip().startswith('\n') or '\n' in params_str:
        new_params_str = '\n' + indent + new_params_str + ',\n'

    return prefix + new_params_str + suffix


def split_params(params_str):
    """Split function parameters by comma at depth 0 (ignoring nested parens/brackets)."""
    params = []
    depth = 0
    current = []
    for ch in params_str:
        if ch in '([{':
            depth += 1
            current.append(ch)
        elif ch in ')]}':
            depth -= 1
            current.append(ch)
        elif ch == ',' and depth == 0:
            params.append(''.join(current))
            current = []
        else:
            current.append(ch)
    if current:
        params.append(''.join(current))
    return params


for f in files:
    text = f.read_text(encoding='utf-8')
    new = reorder_function_params(text)
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Reordered: {f}')

print('Done')
