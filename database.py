#!/usr/bin/env python3
"""
MongoDB Database Handler for IndicBERT v2 Fine-tuning System

This module handles all database operations including:
1. File storage and retrieval
2. Fine-tuning data management
3. Model versioning
4. Training history
"""

import os
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Any
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, ConnectionFailure
import gridfs
from bson import ObjectId
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IndicBERTDatabase:
    """MongoDB database handler for IndicBERT v2 fine-tuning system."""
    
    def __init__(self, mongo_uri: str = None, db_name: str = "indicbert_v2"):
        """Initialize database connection."""
        self.mongo_uri = mongo_uri or os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
        self.db_name = db_name
        self.client = None
        self.db = None
        self.fs = None
        self.connect()
        
    def connect(self):
        """Establish database connection."""
        try:
            self.client = MongoClient(self.mongo_uri)
            self.db = self.client[self.db_name]
            self.fs = gridfs.GridFS(self.db)
            
            # Create collections and indexes
            self._setup_collections()
            logger.info(f"Connected to MongoDB database: {self.db_name}")
            
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    def _setup_collections(self):
        """Setup database collections and indexes."""
        # Files collection
        files_collection = self.db.files
        files_collection.create_index([("filename", 1)])
        files_collection.create_index([("upload_date", -1)])
        files_collection.create_index([("language", 1)])
        files_collection.create_index([("file_type", 1)])
        
        # Fine-tuning data collection
        ft_data_collection = self.db.fine_tuning_data
        ft_data_collection.create_index([("file_id", 1)])
        ft_data_collection.create_index([("language", 1)])
        ft_data_collection.create_index([("created_date", -1)])
        
        # Model versions collection
        model_versions_collection = self.db.model_versions
        model_versions_collection.create_index([("version", 1)])
        model_versions_collection.create_index([("created_date", -1)])
        
        # Training history collection
        training_history_collection = self.db.training_history
        training_history_collection.create_index([("model_version", 1)])
        training_history_collection.create_index([("status", 1)])
        training_history_collection.create_index([("created_date", -1)])
        
        # Chat sessions collection
        chat_sessions_collection = self.db.chat_sessions
        chat_sessions_collection.create_index([("session_id", 1)])
        chat_sessions_collection.create_index([("created_date", -1)])
        
        logger.info("Database collections and indexes setup completed")
    
    def store_file(self, file_data: bytes, filename: str, file_type: str, 
                   language: str = "multilingual", metadata: Dict = None) -> str:
        """Store a file in GridFS and metadata in files collection."""
        try:
            # Generate file hash
            file_hash = hashlib.sha256(file_data).hexdigest()
            
            # Check if file already exists
            existing_file = self.db.files.find_one({"file_hash": file_hash})
            if existing_file:
                logger.info(f"File {filename} already exists with hash {file_hash}")
                return str(existing_file["_id"])
            
            # Store file in GridFS
            file_id = self.fs.put(file_data, filename=filename)
            
            # Store metadata
            file_metadata = {
                "filename": filename,
                "file_type": file_type,
                "language": language,
                "file_hash": file_hash,
                "file_size": len(file_data),
                "upload_date": datetime.utcnow(),
                "metadata": metadata or {},
                "status": "uploaded"
            }
            
            # Insert metadata into files collection
            result = self.db.files.insert_one(file_metadata)
            
            logger.info(f"File {filename} stored successfully with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error storing file {filename}: {e}")
            raise
    
    def get_file(self, file_id: str) -> Optional[Dict]:
        """Retrieve file metadata and data."""
        try:
            # Get metadata
            file_metadata = self.db.files.find_one({"_id": ObjectId(file_id)})
            if not file_metadata:
                return None
            
            # Get file data from GridFS
            file_data = self.fs.get(ObjectId(file_id)).read()
            
            return {
                "metadata": file_metadata,
                "data": file_data
            }
            
        except Exception as e:
            logger.error(f"Error retrieving file {file_id}: {e}")
            return None
    
    def list_files(self, language: str = None, file_type: str = None, 
                   limit: int = 100) -> List[Dict]:
        """List files with optional filters."""
        try:
            query = {}
            if language:
                query["language"] = language
            if file_type:
                query["file_type"] = file_type
            
            cursor = self.db.files.find(query).sort("upload_date", -1).limit(limit)
            files = list(cursor)
            
            # Convert ObjectId to string for JSON serialization
            for file in files:
                file["_id"] = str(file["_id"])
                file["upload_date"] = file["upload_date"].isoformat()
            
            return files
            
        except Exception as e:
            logger.error(f"Error listing files: {e}")
            return []
    
    def store_fine_tuning_data(self, file_id: str, processed_data: List[Dict], 
                              language: str, task_type: str) -> str:
        """Store processed fine-tuning data."""
        try:
            ft_data = {
                "file_id": ObjectId(file_id),
                "processed_data": processed_data,
                "language": language,
                "task_type": task_type,
                "data_count": len(processed_data),
                "created_date": datetime.utcnow(),
                "status": "processed"
            }
            
            result = self.db.fine_tuning_data.insert_one(ft_data)
            logger.info(f"Fine-tuning data stored with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error storing fine-tuning data: {e}")
            raise
    
    def get_fine_tuning_data(self, language: str = None, task_type: str = None) -> List[Dict]:
        """Retrieve fine-tuning data."""
        try:
            query = {}
            if language:
                query["language"] = language
            if task_type:
                query["task_type"] = task_type
            
            cursor = self.db.fine_tuning_data.find(query).sort("created_date", -1)
            data = list(cursor)
            
            # Convert ObjectId to string
            for item in data:
                item["_id"] = str(item["_id"])
                item["file_id"] = str(item["file_id"])
                item["created_date"] = item["created_date"].isoformat()
            
            return data
            
        except Exception as e:
            logger.error(f"Error retrieving fine-tuning data: {e}")
            return []
    
    def create_model_version(self, base_model: str, fine_tuned_data_ids: List[str], 
                           parameters: Dict) -> str:
        """Create a new model version record."""
        try:
            model_version = {
                "version": f"{base_model}_v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                "base_model": base_model,
                "fine_tuned_data_ids": [ObjectId(id) for id in fine_tuned_data_ids],
                "parameters": parameters,
                "created_date": datetime.utcnow(),
                "status": "created"
            }
            
            result = self.db.model_versions.insert_one(model_version)
            logger.info(f"Model version created: {model_version['version']}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error creating model version: {e}")
            raise
    
    def update_model_version_status(self, version_id: str, status: str, 
                                  additional_info: Dict = None):
        """Update model version status."""
        try:
            update_data = {"status": status}
            if additional_info:
                update_data.update(additional_info)
            
            self.db.model_versions.update_one(
                {"_id": ObjectId(version_id)},
                {"$set": update_data}
            )
            logger.info(f"Model version {version_id} status updated to {status}")
            
        except Exception as e:
            logger.error(f"Error updating model version status: {e}")
            raise
    
    def store_training_history(self, model_version_id: str, training_data: Dict) -> str:
        """Store training history."""
        try:
            training_record = {
                "model_version_id": ObjectId(model_version_id),
                "training_data": training_data,
                "status": "started",
                "created_date": datetime.utcnow(),
                "updated_date": datetime.utcnow()
            }
            
            result = self.db.training_history.insert_one(training_record)
            logger.info(f"Training history stored with ID: {result.inserted_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error storing training history: {e}")
            raise
    
    def update_training_status(self, training_id: str, status: str, 
                             progress: float = None, additional_info: Dict = None):
        """Update training status and progress."""
        try:
            update_data = {
                "status": status,
                "updated_date": datetime.utcnow()
            }
            if progress is not None:
                update_data["progress"] = progress
            if additional_info:
                update_data.update(additional_info)
            
            self.db.training_history.update_one(
                {"_id": ObjectId(training_id)},
                {"$set": update_data}
            )
            logger.info(f"Training {training_id} status updated to {status}")
            
        except Exception as e:
            logger.error(f"Error updating training status: {e}")
            raise
    
    def store_chat_session(self, session_id: str, user_message: str, 
                          ai_response: str, model_used: str, 
                          response_source: str = "fine_tuned") -> str:
        """Store chat session for analysis and improvement."""
        try:
            chat_record = {
                "session_id": session_id,
                "user_message": user_message,
                "ai_response": ai_response,
                "model_used": model_used,
                "response_source": response_source,
                "created_date": datetime.utcnow()
            }
            
            result = self.db.chat_sessions.insert_one(chat_record)
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error storing chat session: {e}")
            return None
    
    def get_chat_history(self, session_id: str, limit: int = 50) -> List[Dict]:
        """Retrieve chat history for a session."""
        try:
            cursor = self.db.chat_sessions.find({"session_id": session_id}).sort("created_date", -1).limit(limit)
            history = list(cursor)
            
            # Convert ObjectId to string
            for item in history:
                item["_id"] = str(item["_id"])
                item["created_date"] = item["created_date"].isoformat()
            
            return history
            
        except Exception as e:
            logger.error(f"Error retrieving chat history: {e}")
            return []
    
    def search_fine_tuned_knowledge(self, query: str, language: str = None, 
                                   limit: int = 10) -> List[Dict]:
        """Search through fine-tuned knowledge base."""
        try:
            # This is a simple text search - in production, you might want to use
            # more sophisticated search like Elasticsearch or vector similarity
            search_query = {"$text": {"$search": query}}
            if language:
                search_query["language"] = language
            
            # Create text index if it doesn't exist
            try:
                self.db.fine_tuning_data.create_index([("processed_data", "text")])
            except:
                pass  # Index might already exist
            
            cursor = self.db.fine_tuning_data.find(search_query).limit(limit)
            results = list(cursor)
            
            # Convert ObjectId to string
            for item in results:
                item["_id"] = str(item["_id"])
                item["file_id"] = str(item["file_id"])
                item["created_date"] = item["created_date"].isoformat()
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching fine-tuned knowledge: {e}")
            return []
    
    def close(self):
        """Close database connection."""
        if self.client:
            self.client.close()
            logger.info("Database connection closed")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

# Global database instance
db_instance = None

def get_database():
    """Get database instance with fallback support."""
    try:
        # Try to get MongoDB database
        if not hasattr(get_database, '_instance') or get_database._instance is None:
            get_database._instance = init_database()
        return get_database._instance
    except Exception as e:
        logger.warning(f"MongoDB not available, using fallback database: {e}")
        # Import and use fallback database
        try:
            from fallback_database import get_fallback_database
            if not hasattr(get_database, '_fallback_instance'):
                get_database._fallback_instance = get_fallback_database()
            return get_database._fallback_instance
        except ImportError:
            logger.error("Fallback database not available")
            raise

def init_database():
    """Initialize database connection."""
    global db_instance
    db_instance = IndicBERTDatabase()
    return db_instance
