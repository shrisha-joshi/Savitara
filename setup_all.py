# 🚀 Savitara - Complete Setup & Verification Script
# This script sets up ALL components and verifies connections

import os
import sys
import subprocess
import platform
import json
from pathlib import Path
from typing import Dict, List, Tuple

# Constants for duplicate literals
MSG_DEPS_INSTALLED = "Dependencies installed"
MSG_DEPS_FAILED = "Failed to install dependencies"
MSG_ENV_EXAMPLE = ".env.example"
MSG_ENV_COPIED = ".env.example copied to .env - Please edit with your credentials"
MSG_ENV_NOT_FOUND = ".env.example not found!"
MSG_ENV_EXISTS = ".env file exists"
MSG_INSTALLING_NODE = "Installing Node.js dependencies..."
CMD_NPM_INSTALL = "npm install"

class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message: str):
    """Print formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(70)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}\n")

def print_success(message: str):
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_error(message: str):
    """Print error message"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def print_info(message: str):
    """Print info message"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")

def run_command(command: str, cwd: str = None, shell: bool = True) -> Tuple[bool, str]:
    """Run a shell command and return success status and output"""
    try:
        result = subprocess.run(
            command,
            shell=shell,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)

def check_prerequisites() -> Dict[str, bool]:
    """Check if all required software is installed"""
    print_header("Checking Prerequisites")
    
    prerequisites = {
        'python': False,
        'node': False,
        'npm': False,
        'git': False,
        'mongodb': False,
        'redis': False
    }
    
    # Check Python
    success, output = run_command("python --version")
    if success:
        version = output.strip()
        print_success(f"Python: {version}")
        prerequisites['python'] = True
    else:
        print_error("Python not found")
    
    # Check Node.js
    success, output = run_command("node --version")
    if success:
        version = output.strip()
        print_success(f"Node.js: {version}")
        prerequisites['node'] = True
    else:
        print_error("Node.js not found")
    
    # Check npm
    success, output = run_command("npm --version")
    if success:
        version = output.strip()
        print_success(f"npm: {version}")
        prerequisites['npm'] = True
    else:
        print_error("npm not found")
    
    # Check Git
    success, output = run_command("git --version")
    if success:
        version = output.strip()
        print_success(f"Git: {version}")
        prerequisites['git'] = True
    else:
        print_warning("Git not found (optional)")
    
    # Check MongoDB
    success, output = run_command("mongod --version")
    if success:
        print_success("MongoDB: Installed")
        prerequisites['mongodb'] = True
    else:
        print_warning("MongoDB not found (can use MongoDB Atlas)")
    
    # Check Redis
    success, output = run_command("redis-cli --version")
    if success:
        print_success("Redis: Installed")
        prerequisites['redis'] = True
    else:
        print_warning("Redis not found (can use Redis Cloud)")
    
    return prerequisites

def _create_venv(backend_dir):
    """Create Python virtual environment"""
    print_info("Creating Python virtual environment...")
    venv_command = "python -m venv venv" if platform.system() == "Windows" else "python3 -m venv venv"
    success, _ = run_command(venv_command, cwd=str(backend_dir))
    if success:
        print_success("Virtual environment created")
    else:
        print_error("Failed to create virtual environment")
    return success

def _install_python_deps(backend_dir):
    """Install Python dependencies"""
    print_info("Installing Python dependencies...")
    pip_command = "venv\\Scripts\\pip install -r requirements.txt" if platform.system() == "Windows" else "venv/bin/pip install -r requirements.txt"
    success, output = run_command(pip_command, cwd=str(backend_dir))
    if success:
        print_success(MSG_DEPS_INSTALLED)
    else:
        print_error(MSG_DEPS_FAILED)
        print(output)
    return success

def _setup_env_file(backend_dir):
    """Setup .env file from example"""
    env_file = backend_dir / ".env"
    env_example = backend_dir / MSG_ENV_EXAMPLE
    
    if env_file.exists():
        print_success(MSG_ENV_EXISTS)
        return True
    
    if not env_example.exists():
        print_error(MSG_ENV_NOT_FOUND)
        return False
    
    print_warning(".env file not found. Please copy .env.example and configure it.")
    copy_cmd = f"copy {env_example} {env_file}" if platform.system() == "Windows" else f"cp {env_example} {env_file}"
    run_command(copy_cmd, cwd=str(backend_dir))
    print_info(MSG_ENV_COPIED)
    return True

def setup_backend():  # noqa: C901
    """Setup backend API"""
    print_header("Setting Up Backend API")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print_error("Backend directory not found!")
        return False
    
    return _create_venv(backend_dir) and _install_python_deps(backend_dir) and _setup_env_file(backend_dir)

def setup_web_app():
    """Setup web application"""
    print_header("Setting Up Web Application")
    
    web_dir = Path("web-app")
    if not web_dir.exists():
        print_error("Web app directory not found!")
        return False
    
    # Install dependencies
    print_info(MSG_INSTALLING_NODE)
    success, output = run_command(CMD_NPM_INSTALL, cwd=str(web_dir))
    if success:
        print_success(MSG_DEPS_INSTALLED)
    else:
        print_error(MSG_DEPS_FAILED)
        print(output)
        return False
    
    # Check .env file
    env_file = web_dir / ".env"
    env_example = web_dir / MSG_ENV_EXAMPLE
    
    if not env_file.exists():
        if env_example.exists():
            print_warning(".env file not found. Copying .env.example...")
            if platform.system() == "Windows":
                run_command(f"copy {env_example} {env_file}", cwd=str(web_dir))
            else:
                run_command(f"cp {env_example} {env_file}", cwd=str(web_dir))
            print_info(MSG_ENV_COPIED)
        else:
            print_error(MSG_ENV_NOT_FOUND)
            return False
    else:
        print_success(MSG_ENV_EXISTS)
    
    return True

def setup_mobile_app():
    """Setup mobile application"""
    print_header("Setting Up Mobile Application")
    
    mobile_dir = Path("mobile-app")
    if not mobile_dir.exists():
        print_error("Mobile app directory not found!")
        return False
    
    # Install dependencies
    print_info(MSG_INSTALLING_NODE)
    success, output = run_command(CMD_NPM_INSTALL, cwd=str(mobile_dir))
    if success:
        print_success(MSG_DEPS_INSTALLED)
    else:
        print_error(MSG_DEPS_FAILED)
        print(output)
        return False
    
    # Check .env file
    env_file = mobile_dir / ".env"
    env_example = mobile_dir / MSG_ENV_EXAMPLE
    
    if not env_file.exists():
        if env_example.exists():
            print_warning(".env file not found. Copying .env.example...")
            if platform.system() == "Windows":
                run_command(f"copy {env_example} {env_file}", cwd=str(mobile_dir))
            else:
                run_command(f"cp {env_example} {env_file}", cwd=str(mobile_dir))
            print_info(MSG_ENV_COPIED)
        else:
            print_error(MSG_ENV_NOT_FOUND)
            return False
    else:
        print_success(MSG_ENV_EXISTS)
    
    return True

def setup_admin_dashboard():
    """Setup admin dashboard"""
    print_header("Setting Up Admin Dashboard")
    
    admin_dir = Path("admin-web")
    if not admin_dir.exists():
        print_error("Admin dashboard directory not found!")
        return False
    
    # Install dependencies
    print_info(MSG_INSTALLING_NODE)
    success, output = run_command(CMD_NPM_INSTALL, cwd=str(admin_dir))
    if success:
        print_success(MSG_DEPS_INSTALLED)
    else:
        print_error(MSG_DEPS_FAILED)
        print(output)
        return False
    
    # Check .env file
    env_file = admin_dir / ".env.local"
    env_example = admin_dir / ".env.local.example"
    
    if not env_file.exists():
        if env_example.exists():
            print_warning(".env.local file not found. Copying .env.local.example...")
            if platform.system() == "Windows":
                run_command(f"copy {env_example} {env_file}", cwd=str(admin_dir))
            else:
                run_command(f"cp {env_example} {env_file}", cwd=str(admin_dir))
            print_info(".env.local.example copied to .env.local - Please edit with your credentials")
        else:
            print_error(".env.local.example not found!")
            return False
    else:
        print_success(".env.local file exists")
    
    return True

def verify_connections():
    """Verify all services can connect"""
    print_header("Verifying Service Connections")
    
    # Check MongoDB connection
    print_info("Testing MongoDB connection...")
    success, _ = run_command("mongosh --eval 'db.runCommand({ping: 1})'")
    if success:
        print_success("MongoDB: Connected")
    else:
        print_warning("MongoDB: Not running or not accessible")
    
    # Check Redis connection
    print_info("Testing Redis connection...")
    success, _ = run_command("redis-cli ping")
    if success:
        print_success("Redis: Connected")
    else:
        print_warning("Redis: Not running or not accessible")
    
    # Check Backend API (if running)
    print_info("Testing Backend API...")
    try:
        import requests
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print_success("Backend API: Healthy")
        else:
            print_warning("Backend API: Responded but not healthy")
    except Exception as e:
        print_warning(f"Backend API: Not running ({e}) - Start with: uvicorn app.main:app --reload")

def print_next_steps():
    """Print instructions for next steps"""
    print_header("Setup Complete!")
    
    print(f"{Colors.OKGREEN}✓ All components have been set up successfully!{Colors.ENDC}\n")
    
    print(f"{Colors.BOLD}Next Steps:{Colors.ENDC}\n")
    
    print(f"{Colors.OKCYAN}1. Configure Environment Variables:{Colors.ENDC}")
    print("   - Edit backend/.env with MongoDB, Redis, Google OAuth credentials")
    print("   - Edit web-app/.env with API URL and Google Client ID")
    print("   - Edit mobile-app/.env with API URL")
    print("   - Edit admin-web/.env.local with API URL\n")
    
    print(f"{Colors.OKCYAN}2. Start Services:{Colors.ENDC}")
    print(f"   {Colors.BOLD}Backend:{Colors.ENDC}")
    print("   cd backend")
    if platform.system() == "Windows":
        print("   venv\\Scripts\\activate")
    else:
        print("   source venv/bin/activate")
    print("   uvicorn app.main:app --reload")
    print("   → http://localhost:8000\n")
    
    print(f"   {Colors.BOLD}Web App:{Colors.ENDC}")
    print("   cd web-app")
    print("   npm run dev")
    print("   → http://localhost:3000\n")
    
    print(f"   {Colors.BOLD}Mobile App:{Colors.ENDC}")
    print("   cd mobile-app")
    print("   npm start")
    print("   → Scan QR code with Expo Go\n")
    
    print(f"   {Colors.BOLD}Admin Dashboard:{Colors.ENDC}")
    print("   cd admin-web")
    print("   npm run dev")
    print("   → http://localhost:3001\n")
    
    print(f"{Colors.OKCYAN}3. Verify APIs:{Colors.ENDC}")
    print("   Open: http://localhost:8000/docs")
    print("   Test all endpoints with Swagger UI\n")
    
    print(f"{Colors.OKCYAN}4. Review Documentation:{Colors.ENDC}")
    print("   - MASTER_README.md - Complete system overview")
    print("   - API_TESTING_GUIDE.md - API testing procedures")
    print("   - PROJECT_STRUCTURE.md - Detailed architecture")
    print("   - DEPLOYMENT.md - Deployment instructions\n")
    
    print(f"{Colors.OKGREEN}{Colors.BOLD}🕉 Happy Coding! 🕉{Colors.ENDC}\n")

def main():
    """Main setup function"""
    print_header("Savitara Platform Setup")
    print(f"{Colors.BOLD}Complete setup for all platform components{Colors.ENDC}\n")
    
    # Check prerequisites
    prereqs = check_prerequisites()
    
    if not prereqs['python']:
        print_error("Python is required! Please install Python 3.11+")
        sys.exit(1)
    
    if not prereqs['node'] or not prereqs['npm']:
        print_error("Node.js and npm are required! Please install Node.js 18+")
        sys.exit(1)
    
    if not prereqs['mongodb']:
        print_warning("MongoDB not found locally. You can use MongoDB Atlas instead.")
    
    if not prereqs['redis']:
        print_warning("Redis not found locally. You can use Redis Cloud instead.")
    
    # Setup components
    components = {
        'Backend API': setup_backend,
        'Web Application': setup_web_app,
        'Mobile Application': setup_mobile_app,
        'Admin Dashboard': setup_admin_dashboard
    }
    
    results = {}
    for name, setup_func in components.items():
        try:
            results[name] = setup_func()
        except Exception as e:
            print_error(f"Error setting up {name}: {str(e)}")
            results[name] = False
    
    # Verify connections
    verify_connections()
    
    # Print summary
    print_header("Setup Summary")
    for name, success in results.items():
        if success:
            print_success(f"{name}: Setup completed")
        else:
            print_error(f"{name}: Setup failed")
    
    # Print next steps
    if all(results.values()):
        print_next_steps()
    else:
        print_warning("\nSome components failed to set up. Please check errors above.")
        print_info("You can still proceed with successfully configured components.\n")

if __name__ == "__main__":
    main()
