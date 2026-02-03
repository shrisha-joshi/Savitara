"""Test chat sanitization patterns"""
import re

# Production patterns
patterns = {
    'indian_phone': r'(?<!\d)(?:\+?91[\s\-]?)?[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}(?!\d)',
    'indian_phone_spaced': r'(?<!\d)[6-9]\d[\s\-]\d{4}[\s\-]\d{4}(?!\d)',  # Catches "98 7654 3210"
    'intl_phone': r'(?<!\d)\+\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{2,4}(?!\d)',
    'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    'obfuscated_at': r'(?<!\S)(?:at|\[at\]|\(at\)|@)(?!\S)',
    'obfuscated_dot': r'(?<!\S)(?:dot|\[dot\]|\(dot\)|\.)(?!\S)',
    'social': r'(whatsapp|telegram|signal|instagram|insta|wa\.me|t\.me)',
    'url': r'(https?://|www\.|[a-zA-Z0-9-]+\.(com|net|org|in|ai|io|co|biz))'
}

test_cases = [
    'Call me at 9876543210',
    'Email: test@gmail.com',
    'My number is +91-98765-43210',
    'Contact me at test dot com',
    'whatsapp me at 9988776655',
    'reach me on instagram @username',
    'Visit my website.com',
    'Email me (at) gmail (dot) com',
    'Number: 98 7654 3210',
    'Call +91-98-765-43210',
    'Safe message with no contact info'
]

print("Testing Production-Grade Chat Sanitization:\n")
for case in test_cases:
    blocked = False
    matched_pattern = None
    for name, pattern in patterns.items():
        if re.search(pattern, case, re.IGNORECASE):
            blocked = True
            matched_pattern = name
            break
    
    status = "✅ BLOCKED" if blocked else "✓ ALLOWED"
    result = f"{status} - {matched_pattern or 'NONE'}"
    print(f"{result:30} | {case}")
    results.append({'case': case, 'blocked': blocked})

# Check if expected blocks happened
failed = [r for r in results if not r['blocked'] and "Safe message" not in r['case']]
if not failed:
    print("\n✅ All contact-sharing attempts are blocked.")
else:
    print(f"\n❌ {len(failed)} contact-sharing attempts were NOT blocked.")
