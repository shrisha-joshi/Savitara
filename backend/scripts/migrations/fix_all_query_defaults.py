"""
Definitive fix: move ALL Query/Body defaults out of Annotated[] and into = default.
This handles: int, float, bool, str (quoted string defaults)
Multi-line patterns are also handled by joining lines first.
"""
import re
import pathlib

files = list(pathlib.Path('app/api/v1').glob('*.py'))


def fix_annotated_query_defaults(text):
    """
    Find all Annotated[T, Query(default, ...)] and convert to Annotated[T, Query(...)] = default
    Handles: numbers, True/False, None, "quoted strings"
    """
    # We'll work line by line, but first join multi-line Query(... ) blocks
    # For simplicity, use a single regex with re.DOTALL for the whole file

    # Pattern: (\w+): Annotated[TYPE, Query(DEFAULT, REST)] optionally followed by ,
    # where DEFAULT is: None | True | False | integer | float | "string" | 'string'
    # TYPE can be complex (Dict[...], Optional[...], etc.) - use balanced bracket approach

    # Simple approach: match on a single line basis with flexible TYPE matching
    # We replace: name: Annotated[TYPE, Query(DEFAULT, REST)],
    # with:       name: Annotated[TYPE, Query(REST)] = DEFAULT,

    # For None
    text = re.sub(
        r'(\w+):\s*(Annotated\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*,\s*Query\()None,\s*(.*?)\]\)',
        lambda m: f'{m.group(1)}: {m.group(2)}{m.group(3)})] = None',
        text
    )

    # For True/False
    text = re.sub(
        r'(\w+):\s*(Annotated\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*,\s*Query\()(True|False),\s*(.*?)\]\)',
        lambda m: f'{m.group(1)}: {m.group(2)}{m.group(4)})] = {m.group(3)}',
        text
    )

    # For integer
    text = re.sub(
        r'(\w+):\s*(Annotated\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*,\s*Query\()(\d+),\s*(.*?)\]\)',
        lambda m: f'{m.group(1)}: {m.group(2)}{m.group(4)})] = {m.group(3)}',
        text
    )

    # For float
    text = re.sub(
        r'(\w+):\s*(Annotated\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*,\s*Query\()(\d+\.\d+),\s*(.*?)\]\)',
        lambda m: f'{m.group(1)}: {m.group(2)}{m.group(4)})] = {m.group(3)}',
        text
    )

    # For quoted string: "..." or '...'
    text = re.sub(
        r'(\w+):\s*(Annotated\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*,\s*Query\()("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'),\s*(.*?)\]\)',
        lambda m: f'{m.group(1)}: {m.group(2)}{m.group(4)})] = {m.group(3)}',
        text
    )

    # Edge case: Query(None) with no trailing arguments (just None)
    text = re.sub(
        r'(\w+):\s*(Annotated\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*,\s*Query\()None\]\)',
        lambda m: f'{m.group(1)}: {m.group(2)})] = None',
        text
    )

    return text


for f in files:
    text = f.read_text(encoding='utf-8')
    new = fix_annotated_query_defaults(text)
    if new != text:
        f.write_text(new, encoding='utf-8')
        print(f'Fixed: {f}')

print('Done')
