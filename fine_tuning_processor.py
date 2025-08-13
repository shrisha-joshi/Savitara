#!/usr/bin/env python3
"""
Fine-tuning Processor for IndicBERT v2

This module handles:
1. Multilingual data processing
2. Fine-tuning data preparation
3. Model fine-tuning execution
4. Language detection and processing
"""

import os
import json
import csv
import re
import logging
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
import torch
from transformers import (
    AutoTokenizer, 
    AutoModelForMaskedLM,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from datasets import Dataset
import pandas as pd
from indicnlp import common
from indicnlp.normalize import indic_normalize
from indicnlp.tokenize import indic_tokenize
import langdetect
from langdetect import detect, DetectorFactory
import threading
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set seed for reproducibility
DetectorFactory.seed = 0

class MultilingualDataProcessor:
    """Processes multilingual data for fine-tuning."""
    
    def __init__(self):
        """Initialize the processor."""
        self.supported_languages = {
            'hi': 'hindi', 'en': 'english', 'bn': 'bengali', 'ta': 'tamil',
            'te': 'telugu', 'mr': 'marathi', 'gu': 'gujarati', 'kn': 'kannada',
            'ml': 'malayalam', 'pa': 'punjabi', 'or': 'odia', 'as': 'assamese'
        }
        
        # Language-specific processing rules
        self.language_rules = {
            'hindi': {'script': 'devanagari', 'normalize': True},
            'bengali': {'script': 'bengali', 'normalize': True},
            'tamil': {'script': 'tamil', 'normalize': True},
            'telugu': {'script': 'telugu', 'normalize': True},
            'marathi': {'script': 'devanagari', 'normalize': True},
            'gujarati': {'script': 'gujarati', 'normalize': True},
            'kannada': {'script': 'kannada', 'normalize': True},
            'malayalam': {'script': 'malayalam', 'normalize': True},
            'punjabi': {'script': 'gurmukhi', 'normalize': True},
            'odia': {'script': 'odia', 'normalize': True},
            'assamese': {'script': 'bengali', 'normalize': True},
            'english': {'script': 'latin', 'normalize': False}
        }
    
    def detect_language(self, text: str) -> str:
        """Detect the language of the input text."""
        try:
            # Clean text for better detection
            clean_text = re.sub(r'[^\w\s]', '', text.strip())
            if len(clean_text) < 10:
                return 'unknown'
            
            detected_lang = detect(clean_text)
            return self.supported_languages.get(detected_lang, 'unknown')
            
        except Exception as e:
            logger.warning(f"Language detection failed: {e}")
            return 'unknown'
    
    def normalize_text(self, text: str, language: str) -> str:
        """Normalize text based on language-specific rules."""
        try:
            if language not in self.language_rules:
                return text
            
            rules = self.language_rules[language]
            
            if rules['normalize'] and rules['script'] != 'latin':
                # Apply Indic language normalization
                normalizer = indic_normalize.IndicNormalizerFactory.get_normalizer(
                    rules['script']
                )
                normalized_text = normalizer.normalize(text)
                return normalized_text
            
            return text
            
        except Exception as e:
            logger.warning(f"Text normalization failed for {language}: {e}")
            return text
    
    def tokenize_text(self, text: str, language: str) -> List[str]:
        """Tokenize text based on language."""
        try:
            if language not in self.language_rules:
                return text.split()
            
            rules = self.language_rules[language]
            
            if rules['script'] != 'latin':
                # Use Indic language tokenizer
                tokenizer = indic_tokenize.IndicTokenizerFactory.get_tokenizer(
                    rules['script']
                )
                tokens = tokenizer.tokenize(text)
                return tokens
            
            return text.split()
            
        except Exception as e:
            logger.warning(f"Tokenization failed for {language}: {e}")
            return text.split()
    
    def process_text_file(self, file_data: bytes, filename: str) -> List[Dict]:
        """Process text file and extract training data."""
        try:
            text_content = file_data.decode('utf-8', errors='ignore')
            
            # Split into lines/sentences
            lines = [line.strip() for line in text_content.split('\n') if line.strip()]
            
            processed_data = []
            for i, line in enumerate(lines):
                if len(line) < 10:  # Skip very short lines
                    continue
                
                # Detect language
                language = self.detect_language(line)
                if language == 'unknown':
                    continue
                
                # Normalize text
                normalized_text = self.normalize_text(line, language)
                
                # Tokenize
                tokens = self.tokenize_text(normalized_text, language)
                
                processed_data.append({
                    'id': f"{filename}_{i}",
                    'text': normalized_text,
                    'language': language,
                    'tokens': tokens,
                    'token_count': len(tokens),
                    'original_text': line
                })
            
            logger.info(f"Processed {len(processed_data)} lines from {filename}")
            return processed_data
            
        except Exception as e:
            logger.error(f"Error processing text file {filename}: {e}")
            return []
    
    def process_csv_file(self, file_data: bytes, filename: str) -> List[Dict]:
        """Process CSV file and extract training data."""
        try:
            # Try to decode as text first
            text_content = file_data.decode('utf-8', errors='ignore')
            
            # Parse CSV
            lines = text_content.split('\n')
            reader = csv.reader(lines)
            
            processed_data = []
            headers = None
            
            for i, row in enumerate(reader):
                if i == 0:  # Header row
                    headers = row
                    continue
                
                if len(row) < 2:  # Skip empty rows
                    continue
                
                # Assume first column is text, second is language (if available)
                text = row[0].strip()
                if len(text) < 10:
                    continue
                
                # Detect or use provided language
                if len(row) > 1 and row[1].strip():
                    language = self.supported_languages.get(row[1].strip().lower(), 'unknown')
                else:
                    language = self.detect_language(text)
                
                if language == 'unknown':
                    continue
                
                # Normalize and tokenize
                normalized_text = self.normalize_text(text, language)
                tokens = self.tokenize_text(normalized_text, language)
                
                processed_data.append({
                    'id': f"{filename}_{i}",
                    'text': normalized_text,
                    'language': language,
                    'tokens': tokens,
                    'token_count': len(tokens),
                    'original_text': text,
                    'metadata': dict(zip(headers, row)) if headers else {}
                })
            
            logger.info(f"Processed {len(processed_data)} rows from CSV {filename}")
            return processed_data
            
        except Exception as e:
            logger.error(f"Error processing CSV file {filename}: {e}")
            return []
    
    def process_json_file(self, file_data: bytes, filename: str) -> List[Dict]:
        """Process JSON file and extract training data."""
        try:
            # Parse JSON
            data = json.loads(file_data.decode('utf-8'))
            
            processed_data = []
            
            if isinstance(data, list):
                # List of objects
                for i, item in enumerate(data):
                    if isinstance(item, dict):
                        text = item.get('text', '').strip()
                        if len(text) < 10:
                            continue
                        
                        language = item.get('language', self.detect_language(text))
                        if language == 'unknown':
                            continue
                        
                        normalized_text = self.normalize_text(text, language)
                        tokens = self.tokenize_text(normalized_text, language)
                        
                        processed_data.append({
                            'id': f"{filename}_{i}",
                            'text': normalized_text,
                            'language': language,
                            'tokens': tokens,
                            'token_count': len(tokens),
                            'original_text': text,
                            'metadata': item
                        })
            
            elif isinstance(data, dict):
                # Single object or nested structure
                if 'text' in data:
                    text = data['text'].strip()
                    if len(text) >= 10:
                        language = data.get('language', self.detect_language(text))
                        if language != 'unknown':
                            normalized_text = self.normalize_text(text, language)
                            tokens = self.tokenize_text(normalized_text, language)
                            
                            processed_data.append({
                                'id': f"{filename}_0",
                                'text': normalized_text,
                                'language': language,
                                'tokens': tokens,
                                'token_count': len(tokens),
                                'original_text': text,
                                'metadata': data
                            })
            
            logger.info(f"Processed {len(processed_data)} items from JSON {filename}")
            return processed_data
            
        except Exception as e:
            logger.error(f"Error processing JSON file {filename}: {e}")
            return []

class IndicBERTFineTuner:
    """Handles fine-tuning of IndicBERT v2 models."""
    
    def __init__(self, model_name: str = "ai4bharat/IndicBERTv2-MLM-only"):
        """Initialize the fine-tuner."""
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load model and tokenizer
        self._load_model()
    
    def _load_model(self):
        """Load the base model and tokenizer."""
        try:
            logger.info(f"Loading model: {self.model_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForMaskedLM.from_pretrained(self.model_name)
            
            # Move to device
            self.model.to(self.device)
            
            logger.info(f"Model loaded successfully on {self.device}")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    def prepare_training_data(self, processed_data: List[Dict], 
                            max_length: int = 512) -> Dataset:
        """Prepare training data for fine-tuning."""
        try:
            # Filter data by minimum token count
            filtered_data = [item for item in processed_data if item['token_count'] >= 10]
            
            # Prepare text data
            texts = [item['text'] for item in filtered_data]
            
            # Tokenize all texts
            tokenized_data = self.tokenizer(
                texts,
                truncation=True,
                padding=True,
                max_length=max_length,
                return_special_tokens_mask=True,
                return_tensors="pt"
            )
            
            # Create dataset
            dataset = Dataset.from_dict({
                'input_ids': tokenized_data['input_ids'],
                'attention_mask': tokenized_data['attention_mask'],
                'labels': tokenized_data['input_ids'].clone()
            })
            
            logger.info(f"Prepared training dataset with {len(dataset)} samples")
            return dataset
            
        except Exception as e:
            logger.error(f"Error preparing training data: {e}")
            raise
    
    def fine_tune_model(self, training_data: Dataset, 
                       output_dir: str = "./fine_tuned_model",
                       training_args: Dict = None) -> str:
        """Fine-tune the model on the provided data."""
        try:
            # Default training arguments
            default_args = {
                'output_dir': output_dir,
                'num_train_epochs': 3,
                'per_device_train_batch_size': 8,
                'per_device_eval_batch_size': 8,
                'warmup_steps': 500,
                'weight_decay': 0.01,
                'logging_dir': f"{output_dir}/logs",
                'logging_steps': 100,
                'save_steps': 1000,
                'eval_steps': 1000,
                'evaluation_strategy': "steps",
                'save_strategy': "steps",
                'load_best_model_at_end': True,
                'metric_for_best_model': "eval_loss",
                'greater_is_better': False,
                'dataloader_num_workers': 4,
                'remove_unused_columns': False,
                'push_to_hub': False
            }
            
            # Update with provided arguments
            if training_args:
                default_args.update(training_args)
            
            # Create training arguments
            training_arguments = TrainingArguments(**default_args)
            
            # Data collator for MLM
            data_collator = DataCollatorForLanguageModeling(
                tokenizer=self.tokenizer,
                mlm=True,
                mlm_probability=0.15
            )
            
            # Initialize trainer
            trainer = Trainer(
                model=self.model,
                args=training_arguments,
                train_dataset=training_data,
                data_collator=data_collator,
                tokenizer=self.tokenizer
            )
            
            # Start training
            logger.info("Starting fine-tuning...")
            trainer.train()
            
            # Save the fine-tuned model
            trainer.save_model()
            self.tokenizer.save_pretrained(output_dir)
            
            logger.info(f"Fine-tuning completed. Model saved to {output_dir}")
            return output_dir
            
        except Exception as e:
            logger.error(f"Error during fine-tuning: {e}")
            raise
    
    def evaluate_model(self, test_data: Dataset) -> Dict:
        """Evaluate the fine-tuned model."""
        try:
            # Data collator
            data_collator = DataCollatorForLanguageModeling(
                tokenizer=self.tokenizer,
                mlm=True,
                mlm_probability=0.15
            )
            
            # Create trainer for evaluation
            trainer = Trainer(
                model=self.model,
                data_collator=data_collator,
                tokenizer=self.tokenizer
            )
            
            # Evaluate
            results = trainer.evaluate(test_data)
            
            logger.info(f"Evaluation results: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error during evaluation: {e}")
            raise

class FineTuningManager:
    """Manages the fine-tuning process and coordinates between components."""
    
    def __init__(self, db_connection):
        """Initialize the manager."""
        self.db = db_connection
        self.data_processor = MultilingualDataProcessor()
        self.fine_tuners = {}
        self.training_threads = {}
    
    def process_uploaded_file(self, file_id: str, file_data: bytes, 
                            filename: str, file_type: str) -> Dict:
        """Process an uploaded file and prepare it for fine-tuning."""
        try:
            logger.info(f"Processing file: {filename}")
            
            # Process file based on type
            if file_type == 'text/plain' or filename.endswith('.txt'):
                processed_data = self.data_processor.process_text_file(file_data, filename)
            elif file_type == 'text/csv' or filename.endswith('.csv'):
                processed_data = self.data_processor.process_csv_file(file_data, filename)
            elif file_type == 'application/json' or filename.endswith('.json'):
                processed_data = self.data_processor.process_json_file(file_data, filename)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            if not processed_data:
                raise ValueError("No valid training data extracted from file")
            
            # Store processed data in database
            ft_data_id = self.db.store_fine_tuning_data(
                file_id=file_id,
                processed_data=processed_data,
                language="multilingual",  # Will be determined per text
                task_type="mlm"
            )
            
            # Update file status
            self.db.update_file_status(file_id, "processed")
            
            result = {
                'success': True,
                'file_id': file_id,
                'ft_data_id': ft_data_id,
                'processed_samples': len(processed_data),
                'languages': list(set(item['language'] for item in processed_data))
            }
            
            logger.info(f"File processing completed: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing file {filename}: {e}")
            # Update file status to failed
            self.db.update_file_status(file_id, "failed", {'error': str(e)})
            return {
                'success': False,
                'error': str(e)
            }
    
    def start_fine_tuning(self, model_name: str, ft_data_ids: List[str], 
                         training_args: Dict = None) -> str:
        """Start fine-tuning process for a specific model."""
        try:
            # Create fine-tuner if not exists
            if model_name not in self.fine_tuners:
                self.fine_tuners[model_name] = IndicBERTFineTuner(model_name)
            
            fine_tuner = self.fine_tuners[model_name]
            
            # Get fine-tuning data from database
            all_processed_data = []
            for ft_data_id in ft_data_ids:
                ft_data = self.db.get_fine_tuning_data_by_id(ft_data_id)
                if ft_data:
                    all_processed_data.extend(ft_data['processed_data'])
            
            if not all_processed_data:
                raise ValueError("No fine-tuning data found")
            
            # Prepare training data
            training_dataset = fine_tuner.prepare_training_data(all_processed_data)
            
            # Create model version record
            model_version_id = self.db.create_model_version(
                base_model=model_name,
                fine_tuned_data_ids=ft_data_ids,
                parameters=training_args or {}
            )
            
            # Store training history
            training_id = self.db.store_training_history(
                model_version_id=model_version_id,
                training_data={
                    'model_name': model_name,
                    'ft_data_ids': ft_data_ids,
                    'training_args': training_args,
                    'dataset_size': len(training_dataset)
                }
            )
            
            # Start training in background thread
            training_thread = threading.Thread(
                target=self._run_fine_tuning,
                args=(fine_tuner, training_dataset, training_id, model_version_id, training_args)
            )
            training_thread.start()
            
            self.training_threads[training_id] = training_thread
            
            logger.info(f"Fine-tuning started for {model_name} with training ID: {training_id}")
            return training_id
            
        except Exception as e:
            logger.error(f"Error starting fine-tuning: {e}")
            raise
    
    def _run_fine_tuning(self, fine_tuner, training_dataset, training_id, 
                         model_version_id, training_args):
        """Run fine-tuning in background thread."""
        try:
            # Update status to training
            self.db.update_training_status(training_id, "training", 0)
            
            # Start fine-tuning
            output_dir = fine_tuner.fine_tune_model(
                training_data=training_dataset,
                training_args=training_args
            )
            
            # Update status to completed
            self.db.update_training_status(
                training_id, 
                "completed", 
                100, 
                {'output_dir': output_dir}
            )
            
            # Update model version status
            self.db.update_model_version_status(
                model_version_id, 
                "trained", 
                {'output_dir': output_dir}
            )
            
            logger.info(f"Fine-tuning completed for training ID: {training_id}")
            
        except Exception as e:
            logger.error(f"Error during fine-tuning for training ID {training_id}: {e}")
            # Update status to failed
            self.db.update_training_status(
                training_id, 
                "failed", 
                additional_info={'error': str(e)}
            )
    
    def get_training_status(self, training_id: str) -> Dict:
        """Get the status of a training process."""
        try:
            training_record = self.db.get_training_history_by_id(training_id)
            if not training_record:
                return {'error': 'Training record not found'}
            
            return {
                'training_id': training_id,
                'status': training_record['status'],
                'progress': training_record.get('progress', 0),
                'created_date': training_record['created_date'],
                'updated_date': training_record['updated_date'],
                'additional_info': training_record.get('additional_info', {})
            }
            
        except Exception as e:
            logger.error(f"Error getting training status: {e}")
            return {'error': str(e)}
    
    def list_available_models(self) -> List[Dict]:
        """List all available fine-tuned models."""
        try:
            model_versions = self.db.get_model_versions()
            return model_versions
            
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []

# Global instance
fine_tuning_manager = None

def get_fine_tuning_manager(db_connection):
    """Get global fine-tuning manager instance."""
    global fine_tuning_manager
    if fine_tuning_manager is None:
        fine_tuning_manager = FineTuningManager(db_connection)
    return fine_tuning_manager
