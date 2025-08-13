#!/usr/bin/env python3
"""
Test script for IndicBERT v2 AI Chat Assistant

This script tests the chat API endpoints to ensure they're working correctly.
"""

import requests
import json

def test_chat_api():
    """Test the chat API endpoint."""
    base_url = "http://localhost:5000"
    
    print("🧪 Testing IndicBERT v2 AI Chat Assistant...")
    print("=" * 50)
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{base_url}/")
        print(f"✅ Server is running (Status: {response.status_code})")
    except requests.exceptions.ConnectionError:
        print("❌ Server is not running. Please start the server first.")
        return False
    
    # Test 2: Test chat API
    print("\n📝 Testing Chat API...")
    chat_data = {
        "message": "Hello, how are you?",
        "model_key": "IndicBERTv2-MLM-only",
        "language": "english"
    }
    
    try:
        response = requests.post(f"{base_url}/api/chat", json=chat_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Chat API working! Response: {result['response']}")
        else:
            print(f"❌ Chat API failed (Status: {response.status_code})")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Chat API error: {e}")
    
    # Test 3: Test model loading
    print("\n🤖 Testing Model Loading...")
    model_data = {
        "model_key": "IndicBERTv2-MLM-only",
        "task_type": "mlm"
    }
    
    try:
        response = requests.post(f"{base_url}/api/load_model", json=model_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Model loading working! {result['message']}")
        else:
            print(f"❌ Model loading failed (Status: {response.status_code})")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Model loading error: {e}")
    
    # Test 4: Test available models
    print("\n📋 Testing Available Models...")
    try:
        response = requests.get(f"{base_url}/api/models")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Available models: {list(result['available_models'].keys())}")
        else:
            print(f"❌ Models API failed (Status: {response.status_code})")
    except Exception as e:
        print(f"❌ Models API error: {e}")
    
    # Test 5: Test languages
    print("\n🌐 Testing Languages...")
    try:
        response = requests.get(f"{base_url}/api/languages")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Available languages: {list(result.keys())}")
        else:
            print(f"❌ Languages API failed (Status: {response.status_code})")
    except Exception as e:
        print(f"❌ Languages API error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Testing completed!")
    print(f"🌐 Open your browser and go to: {base_url}")
    print("💬 Start chatting with the AI assistant!")
    
    return True

if __name__ == "__main__":
    test_chat_api()
