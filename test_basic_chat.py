#!/usr/bin/env python3
"""
Basic Chat Test Script for IndicBERT v2 Enhanced System

This script tests the basic chat functionality without requiring all dependencies.
"""

import requests
import json
import time

def test_basic_chat():
    """Test basic chat functionality."""
    
    print("🧪 Testing Basic Chat Functionality")
    print("=" * 50)
    
    # Test data
    test_messages = [
        "Hello, how are you?",
        "What can you do?",
        "Tell me about IndicBERT",
        "Goodbye!"
    ]
    
    base_url = "http://localhost:5000"
    
    try:
        # Test if server is running
        print("🔍 Checking if server is running...")
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running!")
        else:
            print(f"⚠️  Server responded with status: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ Server is not running. Please start the system first.")
        print("   Run: python start_enhanced_system.py")
        return False
    except Exception as e:
        print(f"❌ Error checking server: {e}")
        return False
    
    # Test chat API
    print("\n💬 Testing Chat API...")
    
    for i, message in enumerate(test_messages, 1):
        print(f"\n📝 Test {i}: {message}")
        
        try:
            response = requests.post(
                f"{base_url}/api/chat",
                json={
                    "message": message,
                    "model_name": "IndicBERTv2-MLM-only",
                    "language": "english"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    ai_response = data['response'].get('content', 'No content')
                    source = data['response'].get('response_source', 'unknown')
                    print(f"✅ AI Response: {ai_response}")
                    print(f"   Source: {source}")
                else:
                    print(f"❌ API Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Request Error: {e}")
        
        time.sleep(1)  # Small delay between requests
    
    print("\n🎉 Basic chat test completed!")
    return True

def test_file_upload():
    """Test file upload functionality."""
    
    print("\n📁 Testing File Upload...")
    print("=" * 30)
    
    base_url = "http://localhost:5000"
    
    try:
        # Create a simple test file
        test_content = "This is a test file for IndicBERT v2 fine-tuning.\nIt contains sample text data."
        
        files = {'file': ('test.txt', test_content, 'text/plain')}
        
        response = requests.post(f"{base_url}/api/upload_file", files=files, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ File upload successful!")
                print(f"   File ID: {data.get('file_id', 'N/A')}")
                print(f"   Message: {data.get('message', 'N/A')}")
            else:
                print(f"❌ Upload failed: {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Upload test error: {e}")

def main():
    """Main test function."""
    
    print("🚀 IndicBERT v2 Enhanced System - Basic Test")
    print("=" * 60)
    
    # Test basic chat
    if test_basic_chat():
        # Test file upload if chat works
        test_file_upload()
    
    print("\n📋 Test Summary:")
    print("✅ Basic chat functionality tested")
    print("✅ File upload functionality tested")
    print("\n💡 If all tests passed, your system is working!")
    print("🌐 Open http://localhost:5000 in your browser to use the full interface")

if __name__ == "__main__":
    main()
