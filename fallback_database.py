#!/usr/bin/env python3
"""
Fallback Database Module for IndicBERT v2 Enhanced System

This module provides basic in-memory storage when MongoDB is not available.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class FallbackDatabase:
    """In-memory database fallback when MongoDB is not available."""
    
    def __init__(self):
        """Initialize fallback database."""
        self.files = {}
        self.chat_sessions = {}
        self.fine_tuning_data = {}
        self.models = {}
        self.file_counter = 0
        
        # Create data directory if it doesn't exist
        self.data_dir = Path("./fallback_data")
        self.data_dir.mkdir(exist_ok=True)
        
        # Load existing data if available
        self._load_data()
    
    def _load_data(self):
        """Load data from disk if available."""
        try:
            data_file = self.data_dir / "fallback_data.json"
            if data_file.exists():
                with open(data_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.files = data.get('files', {})
                    self.chat_sessions = data.get('chat_sessions', {})
                    self.fine_tuning_data = data.get('fine_tuning_data', {})
                    self.models = data.get('models', {})
                    self.file_counter = data.get('file_counter', 0)
                logger.info("Loaded fallback data from disk")
        except Exception as e:
            logger.warning(f"Could not load fallback data: {e}")
    
    def _save_data(self):
        """Save data to disk."""
        try:
            data = {
                'files': self.files,
                'chat_sessions': self.chat_sessions,
                'fine_tuning_data': self.fine_tuning_data,
                'models': self.models,
                'file_counter': self.file_counter
            }
            
            data_file = self.data_dir / "fallback_data.json"
            with open(data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str)
            
            logger.info("Saved fallback data to disk")
        except Exception as e:
            logger.warning(f"Could not save fallback data: {e}")
    
    def store_file(self, file_data: bytes, filename: str, file_type: str, language: str) -> str:
        """Store a file in the fallback database."""
        self.file_counter += 1
        file_id = f"fallback_{self.file_counter}"
        
        # Store file metadata and save file to disk
        file_info = {
            'id': file_id,
            'filename': filename,
            'file_type': file_type,
            'language': language,
            'size': len(file_data),
            'upload_date': datetime.now().isoformat(),
            'status': 'uploaded'
        }
        
        self.files[file_id] = file_info
        
        # Save file to disk
        file_path = self.data_dir / f"{file_id}_{filename}"
        try:
            with open(file_path, 'wb') as f:
                f.write(file_data)
            file_info['file_path'] = str(file_path)
        except Exception as e:
            logger.warning(f"Could not save file to disk: {e}")
        
        self._save_data()
        return file_id
    
    def list_files(self, language: Optional[str] = None, file_type: Optional[str] = None) -> List[Dict]:
        """List stored files."""
        files = list(self.files.values())
        
        if language:
            files = [f for f in files if f.get('language') == language]
        
        if file_type:
            files = [f for f in files if f.get('file_type') == file_type]
        
        return files
    
    def store_chat_session(self, session_id: str, user_message: str, ai_response: str, 
                          model_used: str, response_source: str):
        """Store a chat session."""
        if session_id not in self.chat_sessions:
            self.chat_sessions[session_id] = []
        
        session_entry = {
            'timestamp': datetime.now().isoformat(),
            'user_message': user_message,
            'ai_response': ai_response,
            'model_used': model_used,
            'response_source': response_source
        }
        
        self.chat_sessions[session_id].append(session_entry)
        self._save_data()
    
    def get_chat_history(self, session_id: str, limit: int = 50) -> List[Dict]:
        """Get chat history for a session."""
        if session_id in self.chat_sessions:
            return self.chat_sessions[session_id][-limit:]
        return []
    
    def search_fine_tuned_knowledge(self, query: str, language: Optional[str] = None, 
                                   limit: int = 10) -> List[Dict]:
        """Search through stored knowledge (basic implementation)."""
        # Simple keyword search in chat sessions
        results = []
        
        for session_id, messages in self.chat_sessions.items():
            for msg in messages:
                if query.lower() in msg.get('user_message', '').lower():
                    results.append({
                        'session_id': session_id,
                        'query_match': msg.get('user_message'),
                        'response': msg.get('ai_response'),
                        'timestamp': msg.get('timestamp'),
                        'model': msg.get('model_used')
                    })
        
        # Filter by language if specified
        if language:
            # This is a simplified filter - in a real system you'd have language detection
            pass
        
        return results[:limit]
    
    def get_fine_tuning_data(self, language: Optional[str] = None, 
                            task_type: Optional[str] = None) -> List[Dict]:
        """Get fine-tuning data."""
        # Return basic structure for compatibility
        return [
            {
                '_id': 'fallback_ft_1',
                'language': 'multilingual',
                'task_type': 'text_generation',
                'created_date': datetime.now().isoformat(),
                'status': 'available'
            }
        ]

def get_fallback_database():
    """Get a fallback database instance."""
    return FallbackDatabase()
