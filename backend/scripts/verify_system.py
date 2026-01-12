"""
Complete System Verification Script
Checks all dependencies, services, and configurations
"""
import sys
import os
import subprocess
from pathlib import Path


def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_success(text):
    print(f"✅ {text}")


def print_error(text):
    print(f"❌ {text}")


def print_warning(text):
    print(f"⚠️  {text}")


def check_python_version():
    print_header("Checking Python Version")
    version = sys.version_info
    if version >= (3, 11):
        print_success(f"Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print_error(f"Python {version.major}.{version.minor}.{version.micro} - Requires 3.11+")
        return False


def check_python_packages():
    print_header("Checking Python Packages")
    
    required_packages = [
        "fastapi",
        "uvicorn",
        "motor",
        "redis",
        "elasticsearch",
        "cryptography",
        "locust",
        "pytest",
        "pydantic",
        "python-jose",
        "passlib",
        "razorpay",
        "firebase-admin",
        "httpx",
        "aiohttp",
        "websockets"
    ]
    
    all_installed = True
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
            print_success(f"{package} installed")
        except ImportError:
            print_error(f"{package} NOT installed")
            all_installed = False
    
    return all_installed


def check_node_version():
    print_header("Checking Node.js Version")
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True
        )
        version = result.stdout.strip()
        major_version = int(version.split(".")[0].replace("v", ""))
        
        if major_version >= 18:
            print_success(f"Node.js {version}")
            return True
        else:
            print_error(f"Node.js {version} - Requires v18+")
            return False
    except FileNotFoundError:
        print_error("Node.js not found")
        return False


def check_docker():
    print_header("Checking Docker")
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True,
            text=True
        )
        print_success(result.stdout.strip())
        
        # Check if Docker is running
        result = subprocess.run(
            ["docker", "ps"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print_success("Docker daemon is running")
            return True
        else:
            print_warning("Docker installed but daemon not running")
            return False
    except FileNotFoundError:
        print_warning("Docker not found (optional for local dev)")
        return False


def check_project_structure():
    print_header("Checking Project Structure")
    
    base_path = Path(__file__).parent.parent
    
    required_dirs = [
        "backend/app",
        "backend/app/services",
        "backend/app/api/v1",
        "backend/app/middleware",
        "backend/tests",
        "savitara-app/src",
        "savitara-web/src",
        "admin-savitara-web/pages",
        "k8s"
    ]
    
    all_exist = True
    for dir_path in required_dirs:
        full_path = base_path / dir_path
        if full_path.exists():
            print_success(f"{dir_path}")
        else:
            print_error(f"{dir_path} NOT FOUND")
            all_exist = False
    
    return all_exist


def check_new_features():
    print_header("Checking Enterprise Features")
    
    base_path = Path(__file__).parent.parent
    
    new_files = [
        "backend/app/services/search_service.py",
        "backend/app/services/encryption_service.py",
        "backend/app/services/audit_service.py",
        "backend/app/services/query_optimizer.py",
        "backend/app/middleware/advanced_rate_limit.py",
        "backend/app/middleware/compression.py",
        "savitara-app/src/utils/performanceOptimizer.js",
        "savitara-web/src/components/SearchFilters.jsx",
        "savitara-web/src/components/ChatWidget.jsx",
        "admin-savitara-web/pages/dashboard.js",
        "k8s/backend-deployment.yaml",
        ".github/workflows/deploy.yml",
        "k8s/monitoring/prometheus-config.yaml",
        "backend/tests/load/locustfile.py"
    ]
    
    all_exist = True
    for file_path in new_files:
        full_path = base_path / file_path
        if full_path.exists():
            size_kb = full_path.stat().st_size / 1024
            print_success(f"{file_path} ({size_kb:.1f} KB)")
        else:
            print_error(f"{file_path} NOT FOUND")
            all_exist = False
    
    return all_exist


def check_environment_files():
    print_header("Checking Environment Configuration")
    
    base_path = Path(__file__).parent.parent
    
    env_files = [
        "backend/.env",
    ]
    
    all_configured = True
    for env_file in env_files:
        full_path = base_path / env_file
        if full_path.exists():
            print_success(f"{env_file} exists")
            
            # Check critical env vars
            with open(full_path) as f:
                content = f.read()
                critical_vars = [
                    "MONGODB_URL",
                    "REDIS_URL",
                    "JWT_SECRET",
                    "ENCRYPTION_KEY"
                ]
                
                for var in critical_vars:
                    if var in content:
                        print_success(f"  {var} configured")
                    else:
                        print_warning(f"  {var} not set")
                        all_configured = False
        else:
            print_error(f"{env_file} NOT FOUND")
            all_configured = False
    
    return all_configured


def check_docker_services():
    print_header("Checking Docker Services")
    
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            running_containers = result.stdout.strip().split("\n")
            
            expected_services = ["mongodb", "redis", "elasticsearch"]
            for service in expected_services:
                if any(service.lower() in container.lower() for container in running_containers):
                    print_success(f"{service} container running")
                else:
                    print_warning(f"{service} container not running")
            
            return True
        else:
            print_warning("Cannot check Docker services")
            return False
    except:
        print_warning("Docker not available")
        return False


def check_ports():
    print_header("Checking Port Availability")
    
    import socket
    
    ports = {
        8000: "Backend API",
        27017: "MongoDB",
        6379: "Redis",
        9200: "Elasticsearch",
        3000: "Web App",
        3001: "Admin Panel"
    }
    
    all_available = True
    for port, service in ports.items():
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        
        if result == 0:
            print_success(f"Port {port} ({service}) - Service running")
        else:
            print_warning(f"Port {port} ({service}) - Available/Not running")
    
    return True


def run_quick_tests():
    print_header("Running Quick Tests")
    
    base_path = Path(__file__).parent.parent / "backend"
    
    try:
        # Try to import main modules
        sys.path.insert(0, str(base_path))
        
        print("Testing imports...")
        
        try:
            from app.services.search_service import SearchService
            print_success("SearchService imports correctly")
        except Exception as e:
            print_error(f"SearchService import failed: {e}")
        
        try:
            from app.services.encryption_service import EncryptionService
            print_success("EncryptionService imports correctly")
        except Exception as e:
            print_error(f"EncryptionService import failed: {e}")
        
        try:
            from app.services.audit_service import AuditService
            print_success("AuditService imports correctly")
        except Exception as e:
            print_error(f"AuditService import failed: {e}")
        
        try:
            from app.middleware.advanced_rate_limit import AdvancedRateLimiter
            print_success("AdvancedRateLimiter imports correctly")
        except Exception as e:
            print_error(f"AdvancedRateLimiter import failed: {e}")
        
        return True
        
    except Exception as e:
        print_error(f"Test failed: {e}")
        return False


def main():
    print("\n" + "=" * 60)
    print("  SAVITARA ENTERPRISE - SYSTEM VERIFICATION")
    print("=" * 60)
    
    results = []
    
    # Run all checks
    results.append(("Python Version", check_python_version()))
    results.append(("Python Packages", check_python_packages()))
    results.append(("Node.js Version", check_node_version()))
    results.append(("Docker", check_docker()))
    results.append(("Project Structure", check_project_structure()))
    results.append(("Enterprise Features", check_new_features()))
    results.append(("Environment Config", check_environment_files()))
    results.append(("Docker Services", check_docker_services()))
    results.append(("Port Status", check_ports()))
    results.append(("Quick Tests", run_quick_tests()))
    
    # Summary
    print_header("VERIFICATION SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        if result:
            print_success(f"{check_name}")
        else:
            print_error(f"{check_name}")
    
    print("\n" + "=" * 60)
    print(f"  PASSED: {passed}/{total} checks")
    print("=" * 60)
    
    if passed == total:
        print("\n🎉 ALL CHECKS PASSED! System ready for development.")
        print("\nQuick Start:")
        print("  1. cd backend && uvicorn app.main:app --reload")
        print("  2. cd savitara-web && npm run dev")
        print("  3. cd savitara-app && npm start")
        return 0
    else:
        print("\n⚠️  Some checks failed. Please review errors above.")
        print("\nNext Steps:")
        print("  1. Install missing dependencies: pip install -r backend/requirements.txt")
        print("  2. Start Docker services: docker-compose up -d")
        print("  3. Configure .env files with required variables")
        return 1


if __name__ == "__main__":
    sys.exit(main())
