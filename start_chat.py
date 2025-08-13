#!/usr/bin/env python3
"""
Startup script for IndicBERT v2 AI Chat Assistant

This script starts the enhanced web demo with the new chat interface.
"""

import os
import sys
import subprocess

def check_dependencies():
    """Check if required packages are installed."""
    try:
        import flask
        import torch
        import transformers
        print("✅ All dependencies are installed!")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please install dependencies with: pip install -r enhanced_requirements.txt")
        return False

def start_chat():
    """Start the chat interface."""
    print("🚀 Starting IndicBERT v2 AI Chat Assistant...")
    print("=" * 50)
    
    if not check_dependencies():
        return False
    
    try:
        # Import and run the web demo
        from web_demo import app
        
        print("✅ Chat interface loaded successfully")
        print("🌐 Starting server at http://localhost:5000")
        print("📱 Open your browser and navigate to the URL above")
        print("💬 The new chat interface will be available at the root URL")
        print("🔧 Original demo interface available at /demo")
        print("⏹️  Press Ctrl+C to stop the server")
        print("=" * 50)
        
        # Start the Flask app
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except ImportError as e:
        print(f"❌ Error importing web demo: {e}")
        print("Please check that all dependencies are installed correctly.")
        return False
    except Exception as e:
        print(f"❌ Error starting chat: {e}")
        return False

def main():
    """Main function."""
    print("IndicBERT v2 AI Chat Assistant")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists("web_demo.py"):
        print("❌ Error: web_demo.py not found in current directory")
        print("Please run this script from the IndicBERTv2 project directory")
        return
    
    # Start the chat interface
    start_chat()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Chat assistant stopped by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        print("Please check the error message and try again")
