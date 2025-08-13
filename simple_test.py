#!/usr/bin/env python3
"""
Simple Test Script for IndicBERT v2 Enhanced System

This script tests the basic functionality without complex dependencies.
"""

import requests
import json
import time

def test_system():
    """Test the basic system functionality."""
    
    print("🧪 Testing IndicBERT v2 Enhanced System")
    print("=" * 50)
    
    base_url = "http://localhost:5000"
    
    # Test 1: Basic page load
    print("\n1️⃣ Testing basic page load...")
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            print("✅ Basic page loads successfully")
        else:
            print(f"❌ Page load failed: {response.status_code}")
            print(f"Response: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ Page load error: {e}")
    
    # Test 2: Chat endpoint
    print("\n2️⃣ Testing chat endpoint...")
    try:
        chat_data = {
            "message": "Hello, test message",
            "model_name": "IndicBERTv2-MLM-only",
            "language": "english"
        }
        
        response = requests.post(f"{base_url}/api/chat", json=chat_data, timeout=10)
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("✅ Chat endpoint works")
                print(f"Response data: {json.dumps(data, indent=2)}")
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing failed: {e}")
                print(f"Raw response: {response.text[:500]}...")
        else:
            print(f"❌ Chat endpoint failed with status: {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            
    except Exception as e:
        print(f"❌ Chat endpoint error: {e}")
    
    # Test 3: Files endpoint
    print("\n3️⃣ Testing files endpoint...")
    try:
        response = requests.get(f"{base_url}/api/files", timeout=5)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("✅ Files endpoint works")
                print(f"Files count: {len(data.get('files', []))}")
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing failed: {e}")
                print(f"Raw response: {response.text[:500]}...")
        else:
            print(f"❌ Files endpoint failed with status: {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            
    except Exception as e:
        print(f"❌ Files endpoint error: {e}")
    
    # Test 4: Models endpoint
    print("\n4️⃣ Testing models endpoint...")
    try:
        response = requests.get(f"{base_url}/api/models", timeout=5)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print("✅ Models endpoint works")
                print(f"Models count: {len(data.get('models', []))}")
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing failed: {e}")
                print(f"Raw response: {response.text[:500]}...")
        else:
            print(f"❌ Models endpoint failed with status: {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            
    except Exception as e:
        print(f"❌ Models endpoint error: {e}")

def main():
    """Main test function."""
    
    print("🚀 Starting simple system test...")
    print("Make sure your system is running with: python start_enhanced_system.py")
    print("\n⏳ Waiting 2 seconds before testing...")
    time.sleep(2)
    
    test_system()
    
    print("\n🎉 Test completed!")
    print("\n📝 If you see errors:")
    print("   1. Check if the system is running")
    print("   2. Check the console for error messages")
    print("   3. Verify all dependencies are installed")

if __name__ == "__main__":
    main()
