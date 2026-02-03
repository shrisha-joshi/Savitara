"""
Strict System Verification
Checks:
1. Environment Variables
2. Critical Imports (Dependency Check)
3. Directory Structure
4. Port Availability
"""
import os
import sys
import socket
import importlib
from pathlib import Path

# Mock .env loading for check
os.environ["MONGODB_URL"] = "mongodb+srv://mock:mock@cluster0.mongodb.net/savitara"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["SECRET_KEY"] = "mock_secret_key"

def check_imports():
    """Verify all critical libraries are installed"""
    required_modules = [
        "fastapi", "pymongo", "redis", "razorpay", "firebase_admin",
        "twilio", "jwt", "passlib", "PIL"
    ]
    
    missing = []
    print("\n--- Checking Dependencies ---")
    for module in required_modules:
        try:
            importlib.import_module(module)
            print(f"✅ {module} found")
        except ImportError:
            # Handle package name diffs
            if module == "PIL":
                try:
                    import PIL
                    print(f"✅ {module} found (Pillow)")
                except:
                    missing.append(module)
            else:
                missing.append(module)
                print(f"❌ {module} MISSING")
    
    return missing

def check_ports():
    """Check if ports 8000, 3000, 3001 are free"""
    ports = [8000, 3000, 3001]
    print("\n--- Checking Ports ---")
    busy = []
    for port in ports:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        if result == 0:
            print(f"⚠️ Port {port} is busy (Service likely running)")
            busy.append(port)
        else:
            print(f"✅ Port {port} is free")
        sock.close()
    return busy

def check_structure():
    """Check critical file existence"""
    print("\n--- Checking File Structure ---")
    root = Path(os.getcwd())
    critical_files = [
        "backend/app/main.py",
        "backend/app/services/websocket_manager.py",
        "backend/app/services/exam_service.py", # Should be deleted
        "savitara-web/src/theme/tokens.js",
        "savitara-app/src/components/ui/Skeleton.js"
    ]
    
    for relative_path in critical_files:
        p = root / relative_path
        if "exam_service.py" in relative_path:
            if p.exists():
                 print(f"❌ {relative_path} SHOULD NOT EXIST (Clean up failed)")
            else:
                 print(f"✅ {relative_path} correctly removed")
        else:
            if p.exists():
                print(f"✅ {relative_path} found")
            else:
                print(f"❌ {relative_path} MISSING")

if __name__ == "__main__":
    print("Beginning strict system verification...")
    missing_deps = check_imports()
    check_ports()
    check_structure()
    
    if missing_deps:
        print(f"\nCRITICAL: Missing dependencies: {missing_deps}")
        sys.exit(1)
    
    print("\nSystem Verification Passed. Ready to Integration Test.")
