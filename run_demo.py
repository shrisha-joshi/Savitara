#!/usr/bin/env python3
"""
Setup and Run Script for IndicBERT v2 Demo

This script will:
1. Install required dependencies
2. Run the demo script
3. Show examples of using IndicBERT v2
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages."""
    print("Installing required dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "demo_requirements.txt"])
        print("Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        return False

def run_demo():
    """Run the demo script."""
    print("Running IndicBERT v2 Demo...")
    try:
        subprocess.check_call([sys.executable, "demo.py"])
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running demo: {e}")
        return False

def main():
    print("=" * 60)
    print("IndicBERT v2 Demo Setup and Run")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not os.path.exists("IndicBERT"):
        print("Error: Please run this script from the IndicBERTv2 directory")
        print("Current directory:", os.getcwd())
        return
    
    # Install requirements
    if not install_requirements():
        print("Failed to install dependencies. Please install manually:")
        print("pip install -r demo_requirements.txt")
        return
    
    # Run demo
    if not run_demo():
        print("Failed to run demo.")
        return
    
    print("\n" + "=" * 60)
    print("Demo completed! You can now explore the IndicBERT v2 capabilities.")
    print("=" * 60)

if __name__ == "__main__":
    main()
