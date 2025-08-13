#!/usr/bin/env python3
"""
Test Script for Fixed Issues

This script tests the fixes for the network errors and JSON parsing issues.
"""

import requests
import json
import time

def test_basic_endpoints():
    """Test basic endpoints to ensure they work without database."""
    
    print("🧪 Testing Fixed Endpoints")
    print("=" * 40)
    
    base_url = "http://localhost:5000"
    
    # Test 1: Basic page load
    print("\n1️⃣ Testing basic page load...")
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            print("✅ Basic page loads successfully")
        else:
            print(f"❌ Page load failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Page load error: {e}")
    
    # Test 2: Files endpoint (should work without database)
    print("\n2️⃣ Testing files endpoint...")
    try:
        response = requests.get(f"{base_url}/api/files", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Files endpoint works (returns empty list)")
                print(f"   Files count: {len(data.get('files', []))}")
            else:
                print(f"❌ Files endpoint failed: {data.get('error')}")
        else:
            print(f"❌ Files endpoint HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ Files endpoint error: {e}")
    
    # Test 3: Models endpoint (should work without fine-tuning manager)
    print("\n3️⃣ Testing models endpoint...")
    try:
        response = requests.get(f"{base_url}/api/models", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Models endpoint works (returns basic models)")
                print(f"   Models count: {len(data.get('models', []))}")
            else:
                print(f"❌ Models endpoint failed: {data.get('error')}")
        else:
            print(f"❌ Models endpoint HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ Models endpoint error: {e}")
    
    # Test 4: Chat endpoint (should work with fallback responses)
    print("\n4️⃣ Testing chat endpoint...")
    try:
        chat_data = {
            "message": "Hello, test message",
            "model_name": "IndicBERTv2-MLM-only",
            "language": "english"
        }
        
        response = requests.post(f"{base_url}/api/chat", json=chat_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Chat endpoint works")
                response_content = data.get('response', {})
                print(f"   Response source: {response_content.get('response_source', 'unknown')}")
                print(f"   Content: {response_content.get('content', 'No content')[:100]}...")
            else:
                print(f"❌ Chat endpoint failed: {data.get('error')}")
        else:
            print(f"❌ Chat endpoint HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ Chat endpoint error: {e}")
    
    # Test 5: File upload (should work without database)
    print("\n5️⃣ Testing file upload...")
    try:
        test_content = "This is a test file for IndicBERT v2 fine-tuning.\nIt contains sample text data."
        files = {'file': ('test.txt', test_content, 'text/plain')}
        
        response = requests.post(f"{base_url}/api/upload_file", files=files, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ File upload works")
                print(f"   File ID: {data.get('file_id', 'N/A')}")
                print(f"   Message: {data.get('message', 'N/A')}")
            else:
                print(f"❌ File upload failed: {data.get('error')}")
        else:
            print(f"❌ File upload HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ File upload error: {e}")

def main():
    """Main test function."""
    
    print("🚀 Testing Fixed Issues in IndicBERT v2 Enhanced System")
    print("=" * 60)
    
    print("\n📋 This test will verify that:")
    print("   ✅ Network errors are fixed")
    print("   ✅ JSON parsing errors are resolved")
    print("   ✅ Endpoints work without database")
    print("   ✅ Fallback responses work correctly")
    
    print("\n⏳ Starting tests in 3 seconds...")
    time.sleep(3)
    
    test_basic_endpoints()
    
    print("\n🎉 Test completed!")
    print("\n📝 Summary:")
    print("   - All endpoints should now work without database")
    print("   - Network errors should be resolved")
    print("   - JSON parsing should work correctly")
    print("   - Fallback responses should be provided")
    
    print("\n💡 If all tests passed, your system is working correctly!")
    print("🌐 Open http://localhost:5000 in your browser to use the full interface")

if __name__ == "__main__":
    main()
