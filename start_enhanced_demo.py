#!/usr/bin/env python3
"""
Startup script for Enhanced IndicBERT v2 Demo

This script checks dependencies and starts the enhanced web demo.
"""

import sys
import subprocess
import importlib.util
import os

def check_dependency(module_name, package_name=None):
    """Check if a Python module is available."""
    if package_name is None:
        package_name = module_name
    
    spec = importlib.util.find_spec(module_name)
    if spec is None:
        print(f"❌ {package_name} not found")
        return False
    else:
        print(f"✅ {package_name} found")
        return True

def install_dependency(package_name):
    """Install a Python package using pip."""
    try:
        print(f"Installing {package_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
        return True
    except subprocess.CalledProcessError:
        print(f"Failed to install {package_name}")
        return False

def check_and_install_dependencies():
    """Check and install required dependencies."""
    print("Checking dependencies...")
    
    required_packages = [
        ("flask", "Flask"),
        ("torch", "PyTorch"),
        ("transformers", "Transformers"),
        ("datasets", "Datasets"),
        ("sklearn", "scikit-learn"),
        ("numpy", "NumPy")
    ]
    
    missing_packages = []
    
    for module_name, package_name in required_packages:
        if not check_dependency(module_name, package_name):
            missing_packages.append(package_name)
    
    if missing_packages:
        print(f"\nMissing packages: {', '.join(missing_packages)}")
        print("Installing missing packages...")
        
        for package in missing_packages:
            if not install_dependency(package):
                print(f"Failed to install {package}. Please install manually:")
                print(f"pip install {package}")
                return False
        
        print("All dependencies installed successfully!")
    else:
        print("All dependencies are already installed!")
    
    return True

def start_demo():
    """Start the enhanced IndicBERT v2 demo."""
    print("\n🚀 Starting Enhanced IndicBERT v2 Demo...")
    print("=" * 50)
    
    try:
        # Import and run the web demo
        from web_demo import app
        
        print("✅ Web demo imported successfully")
        print("🌐 Starting server at http://localhost:5000")
        print("📱 Open your browser and navigate to the URL above")
        print("⏹️  Press Ctrl+C to stop the server")
        print("=" * 50)
        
        # Start the Flask app
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except ImportError as e:
        print(f"❌ Error importing web demo: {e}")
        print("Please check that all dependencies are installed correctly.")
        return False
    except Exception as e:
        print(f"❌ Error starting demo: {e}")
        return False

def main():
    """Main function."""
    print("IndicBERT v2 Enhanced Demo Startup")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("web_demo.py"):
        print("❌ Error: web_demo.py not found in current directory")
        print("Please run this script from the IndicBERTv2 project directory")
        return
    
    # Check and install dependencies
    if not check_and_install_dependencies():
        print("❌ Failed to install dependencies. Please install manually:")
        print("pip install -r enhanced_requirements.txt")
        return
    
    # Start the demo
    start_demo()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Demo stopped by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        print("Please check the error message and try again")
