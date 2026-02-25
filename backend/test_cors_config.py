"""Quick test script to check what CORS config is loaded"""
from app.core.config import settings

print("=" * 60)
print("CORS Configuration Test")
print("=" * 60)
print(f"ALLOWED_ORIGINS type: {type(settings.ALLOWED_ORIGINS)}")
print(f"ALLOWED_ORIGINS value: {settings.ALLOWED_ORIGINS}")
print(f"Number of origins: {len(settings.ALLOWED_ORIGINS)}")
print("\nIndividual origins:")
for i, origin in enumerate(settings.ALLOWED_ORIGINS, 1):
    print(f"  {i}. {repr(origin)}")
print("=" * 60)
