#!/usr/bin/env python3
"""
Deployment script for Savitara platform
Handles deployment of backend, mobile app, and admin dashboard
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, cwd=None):
    """Execute shell command and return result"""
    print(f"\n🚀 Running: {command}")
    result = subprocess.run(
        command,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False
    print(f"✅ Success: {result.stdout}")
    return True

def deploy_backend():
    """Deploy FastAPI backend"""
    print("\n" + "="*50)
    print("📦 Deploying Backend API")
    print("="*50)
    
    backend_path = Path("backend")
    
    # Install dependencies
    if not run_command("pip install -r requirements.txt", cwd=backend_path):
        return False
    
    # Run tests (if available)
    print("\n🧪 Running backend tests...")
    run_command("pytest tests/ -v", cwd=backend_path)
    
    # Start server
    print("\n🌐 Starting FastAPI server...")
    print("Backend will be available at: http://localhost:8000")
    print("API Docs: http://localhost:8000/docs")
    
    return True

def deploy_mobile_app():
    """Deploy React Native mobile app"""
    print("\n" + "="*50)
    print("📱 Deploying Mobile App")
    print("="*50)
    
    mobile_path = Path("mobile-app")
    
    # Install dependencies
    if not run_command("npm install", cwd=mobile_path):
        return False
    
    # Build for production
    print("\n📦 Building mobile app...")
    print("For production builds, use:")
    print("  - Android: eas build --platform android")
    print("  - iOS: eas build --platform ios")
    
    return True

def deploy_admin_dashboard():
    """Deploy Next.js admin dashboard"""
    print("\n" + "="*50)
    print("🖥️  Deploying Admin Dashboard")
    print("="*50)
    
    admin_path = Path("admin-web")
    
    # Install dependencies
    if not run_command("npm install", cwd=admin_path):
        return False
    
    # Build for production
    if not run_command("npm run build", cwd=admin_path):
        return False
    
    print("\n🌐 Admin dashboard will be available at: http://localhost:3001")
    
    return True

def check_prerequisites():
    """Check if all required tools are installed"""
    print("\n🔍 Checking prerequisites...")
    
    prerequisites = {
        "Python": "python --version",
        "Node.js": "node --version",
        "npm": "npm --version",
        "MongoDB": "mongod --version",
        "Redis": "redis-cli --version"
    }
    
    missing = []
    for tool, command in prerequisites.items():
        result = subprocess.run(command, shell=True, capture_output=True)
        if result.returncode != 0:
            missing.append(tool)
            print(f"❌ {tool} not found")
        else:
            print(f"✅ {tool} installed")
    
    if missing:
        print(f"\n⚠️  Missing prerequisites: {', '.join(missing)}")
        return False
    
    return True

def main():
    """Main deployment function"""
    print("🎯 Savitara Platform Deployment")
    print("="*50)
    
    if not check_prerequisites():
        print("\n❌ Please install missing prerequisites and try again")
        sys.exit(1)
    
    # Deploy components
    components = {
        "backend": deploy_backend,
        "mobile": deploy_mobile_app,
        "admin": deploy_admin_dashboard,
        "all": lambda: all([deploy_backend(), deploy_mobile_app(), deploy_admin_dashboard()])
    }
    
    if len(sys.argv) > 1 and sys.argv[1] in components:
        component = sys.argv[1]
        if components[component]():
            print(f"\n✅ {component.capitalize()} deployment completed successfully!")
        else:
            print(f"\n❌ {component.capitalize()} deployment failed")
            sys.exit(1)
    else:
        print("\nUsage: python deploy.py [backend|mobile|admin|all]")
        print("\nExample:")
        print("  python deploy.py all       - Deploy all components")
        print("  python deploy.py backend   - Deploy backend only")
        print("  python deploy.py mobile    - Deploy mobile app only")
        print("  python deploy.py admin     - Deploy admin dashboard only")
        sys.exit(1)
    
    print("\n" + "="*50)
    print("🎉 Deployment Complete!")
    print("="*50)
    print("\nNext Steps:")
    print("1. Configure .env files for each component")
    print("2. Start MongoDB: mongod")
    print("3. Start Redis: redis-server")
    print("4. Start Backend: cd backend && uvicorn app.main:app --reload")
    print("5. Start Mobile: cd mobile-app && npm start")
    print("6. Start Admin: cd admin-web && npm run dev")

if __name__ == "__main__":
    main()
