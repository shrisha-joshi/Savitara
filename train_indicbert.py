#!/usr/bin/env python3
"""
IndicBERT v2 Training and Fine-tuning Script

This script provides comprehensive training capabilities for IndicBERT v2 models:
1. Load pretrained models for inference
2. Fine-tune models on custom datasets
3. Support for multiple NLP tasks
4. Training monitoring and evaluation

Usage:
    python train_indicbert.py --mode inference --model ai4bharat/IndicBERTv2-MLM-only
    python train_indicbert.py --mode fine_tune --task classification --data_path data.json
"""

import argparse
import json
import os
import torch
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoModelForQuestionAnswering,
    AutoModelForMaskedLM,
    TrainingArguments,
    Trainer,
    pipeline,
    set_seed
)
from datasets import Dataset, load_dataset, load_metric
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

# Available IndicBERTv2 models
AVAILABLE_MODELS = {
    "IndicBERTv2-MLM-only": "ai4bharat/IndicBERTv2-MLM-only",
    "IndicBERTv2-MLM": "ai4bharat/IndicBERTv2-MLM",
    "IndicBERTv2-MLM-News": "ai4bharat/IndicBERTv2-MLM-News",
    "IndicBERTv2-MLM-News-CC": "ai4bharat/IndicBERTv2-MLM-News-CC"
}

class IndicBERTTrainer:
    """Main class for training and fine-tuning IndicBERT v2 models."""
    
    def __init__(self, model_name: str, task_type: str = "mlm"):
        self.model_name = model_name
        self.task_type = task_type
        self.tokenizer = None
        self.model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        print(f"Using device: {self.device}")
        print(f"Loading model: {model_name}")
        
        self._load_model()
    
    def _load_model(self):
        """Load the specified model and tokenizer."""
        try:
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            # Load model based on task type
            if self.task_type == "mlm":
                self.model = AutoModelForMaskedLM.from_pretrained(self.model_name)
            elif self.task_type == "classification":
                self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            elif self.task_type == "ner":
                self.model = AutoModelForTokenClassification.from_pretrained(self.model_name)
            elif self.task_type == "qa":
                self.model = AutoModelForQuestionAnswering.from_pretrained(self.model_name)
            else:
                self.model = AutoModelForMaskedLM.from_pretrained(self.model_name)
            
            # Move model to device
            self.model.to(self.device)
            
            print(f"Model loaded successfully on {self.device}")
            
        except Exception as e:
            print(f"Error loading model: {e}")
            raise
    
    def run_inference(self, text: str) -> Dict[str, Any]:
        """Run inference on input text."""
        if self.task_type == "mlm":
            return self._run_mlm_inference(text)
        elif self.task_type == "classification":
            return self._run_classification_inference(text)
        elif self.task_type == "ner":
            return self._run_ner_inference(text)
        else:
            return {"error": f"Task type {self.task_type} not supported for inference"}
    
    def _run_mlm_inference(self, text: str) -> Dict[str, Any]:
        """Run masked language modeling inference."""
        try:
            # Check if text contains [MASK] token
            if "[MASK]" not in text:
                return {"error": "Text must contain [MASK] token for MLM inference"}
            
            # Tokenize input
            inputs = self.tokenizer(text, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Run inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
            
            # Find masked tokens and predict
            masked_tokens = []
            for i, token_id in enumerate(inputs['input_ids'][0]):
                if token_id == self.tokenizer.mask_token_id:
                    probs = torch.softmax(logits[0, i], dim=-1)
                    top_k = torch.topk(probs, 5)
                    predictions = []
                    for prob, idx in zip(top_k.values, top_k.indices):
                        predictions.append({
                            'token': self.tokenizer.decode([idx]),
                            'probability': float(prob)
                        })
                    masked_tokens.append({
                        'position': i,
                        'predictions': predictions
                    })
            
            return {
                'task': 'masked_language_modeling',
                'text': text,
                'masked_tokens': masked_tokens,
                'model_used': self.model_name
            }
            
        except Exception as e:
            return {"error": f"MLM inference failed: {str(e)}"}
    
    def _run_classification_inference(self, text: str) -> Dict[str, Any]:
        """Run text classification inference."""
        try:
            # Create pipeline for classification
            classifier = pipeline(
                "text-classification",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if torch.cuda.is_available() else -1
            )
            
            result = classifier(text)
            
            return {
                'task': 'text_classification',
                'text': text,
                'result': result,
                'model_used': self.model_name
            }
            
        except Exception as e:
            return {"error": f"Classification inference failed: {str(e)}"}
    
    def _run_ner_inference(self, text: str) -> Dict[str, Any]:
        """Run named entity recognition inference."""
        try:
            # Create pipeline for NER
            ner_pipeline = pipeline(
                "ner",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if torch.cuda.is_available() else -1
            )
            
            result = ner_pipeline(text)
            
            return {
                'task': 'named_entity_recognition',
                'text': text,
                'result': result,
                'model_used': self.model_name
            }
            
        except Exception as e:
            return {"error": f"NER inference failed: {str(e)}"}
    
    def prepare_dataset(self, data: List[Dict[str, Any]], task_type: str) -> Dataset:
        """Prepare dataset for training."""
        if task_type == "classification":
            return self._prepare_classification_dataset(data)
        elif task_type == "ner":
            return self._prepare_ner_dataset(data)
        else:
            raise ValueError(f"Task type {task_type} not supported for dataset preparation")
    
    def _prepare_classification_dataset(self, data: List[Dict[str, Any]]) -> Dataset:
        """Prepare classification dataset."""
        # Extract texts and labels
        texts = [item['text'] for item in data]
        labels = [item['label'] for item in data]
        
        # Get unique labels
        unique_labels = sorted(list(set(labels)))
        label2id = {label: i for i, label in enumerate(unique_labels)}
        
        # Convert labels to IDs
        label_ids = [label2id[label] for label in labels]
        
        # Tokenize texts
        tokenized = self.tokenizer(
            texts,
            truncation=True,
            padding=True,
            max_length=128,
            return_tensors="pt"
        )
        
        # Create dataset
        dataset_dict = {
            'input_ids': tokenized['input_ids'],
            'attention_mask': tokenized['attention_mask'],
            'labels': torch.tensor(label_ids)
        }
        
        return Dataset.from_dict(dataset_dict)
    
    def _prepare_ner_dataset(self, data: List[Dict[str, Any]]) -> Dataset:
        """Prepare NER dataset."""
        # This is a simplified NER dataset preparation
        # In practice, you'd need more sophisticated entity tagging
        texts = [item['text'] for item in data]
        labels = [item['label'] for item in data]
        
        # Tokenize texts
        tokenized = self.tokenizer(
            texts,
            truncation=True,
            padding=True,
            max_length=128,
            return_tensors="pt"
        )
        
        # Create dataset
        dataset_dict = {
            'input_ids': tokenized['input_ids'],
            'attention_mask': tokenized['attention_mask'],
            'labels': torch.tensor(labels)
        }
        
        return Dataset.from_dict(dataset_dict)
    
    def fine_tune(self, 
                  training_data: List[Dict[str, Any]],
                  validation_data: List[Dict[str, Any]],
                  hyperparameters: Dict[str, Any],
                  output_dir: str = "output") -> Dict[str, Any]:
        """Fine-tune the model on custom data."""
        try:
            print("Preparing datasets...")
            train_dataset = self.prepare_dataset(training_data, self.task_type)
            val_dataset = self.prepare_dataset(validation_data, self.task_type)
            
            print(f"Training dataset size: {len(train_dataset)}")
            print(f"Validation dataset size: {len(val_dataset)}")
            
            # Set up training arguments
            training_args = TrainingArguments(
                output_dir=output_dir,
                num_train_epochs=hyperparameters.get('num_epochs', 5),
                per_device_train_batch_size=hyperparameters.get('batch_size', 16),
                per_device_eval_batch_size=hyperparameters.get('batch_size', 16),
                learning_rate=hyperparameters.get('learning_rate', 3e-5),
                weight_decay=hyperparameters.get('weight_decay', 0.01),
                warmup_steps=hyperparameters.get('warmup_steps', 500),
                logging_dir=f"{output_dir}/logs",
                logging_steps=100,
                evaluation_strategy="steps",
                eval_steps=500,
                save_steps=1000,
                load_best_model_at_end=True,
                metric_for_best_model="eval_loss",
                greater_is_better=False,
                save_total_limit=3,
                fp16=torch.cuda.is_available(),
                report_to="none"  # Disable wandb for simplicity
            )
            
            # Initialize trainer
            trainer = Trainer(
                model=self.model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=val_dataset,
                tokenizer=self.tokenizer
            )
            
            print("Starting fine-tuning...")
            trainer.train()
            
            # Save the fine-tuned model
            final_output_dir = f"{output_dir}/final_model"
            trainer.save_model(final_output_dir)
            self.tokenizer.save_pretrained(final_output_dir)
            
            print(f"Fine-tuning completed! Model saved to {final_output_dir}")
            
            return {
                'success': True,
                'output_dir': final_output_dir,
                'message': 'Fine-tuning completed successfully'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def evaluate(self, test_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Evaluate the fine-tuned model."""
        try:
            test_dataset = self.prepare_dataset(test_data, self.task_type)
            
            # Create trainer for evaluation
            trainer = Trainer(
                model=self.model,
                tokenizer=self.tokenizer
            )
            
            # Run evaluation
            results = trainer.evaluate(test_dataset)
            
            return {
                'success': True,
                'evaluation_results': results
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

def load_data_from_file(file_path: str) -> List[Dict[str, Any]]:
    """Load training data from JSON file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            raise ValueError("Data must be a list of examples")
        
        return data
        
    except Exception as e:
        print(f"Error loading data from {file_path}: {e}")
        raise

def create_sample_data(output_file: str, task_type: str):
    """Create sample training data for demonstration."""
    if task_type == "classification":
        sample_data = [
            {"text": "यह फिल्म बहुत अच्छी है", "label": 1},
            {"text": "मुझे यह पसंद नहीं आया", "label": 0},
            {"text": "बहुत बढ़िया काम किया", "label": 1},
            {"text": "यह अच्छा नहीं है", "label": 0},
            {"text": "शानदार प्रदर्शन", "label": 1},
            {"text": "बेकार है", "label": 0}
        ]
    elif task_type == "ner":
        sample_data = [
            {"text": "मैं दिल्ली में रहता हूं", "label": "LOCATION"},
            {"text": "राहुल ने कहा", "label": "PERSON"},
            {"text": "भारत एक महान देश है", "label": "COUNTRY"}
        ]
    else:
        sample_data = []
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    print(f"Sample data created: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="IndicBERT v2 Training and Fine-tuning")
    parser.add_argument("--mode", type=str, required=True, 
                       choices=["inference", "fine_tune", "create_sample"],
                       help="Mode of operation")
    parser.add_argument("--model", type=str, default="IndicBERTv2-MLM-only",
                       choices=list(AVAILABLE_MODELS.keys()),
                       help="Model to use")
    parser.add_argument("--task_type", type=str, default="mlm",
                       choices=["mlm", "classification", "ner", "qa"],
                       help="Type of NLP task")
    parser.add_argument("--text", type=str, default="भारत एक [MASK] देश है",
                       help="Input text for inference")
    parser.add_argument("--data_path", type=str, help="Path to training data JSON file")
    parser.add_argument("--output_dir", type=str, default="output",
                       help="Output directory for fine-tuned model")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--learning_rate", type=float, default=3e-5, help="Learning rate")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("IndicBERT v2 Training and Fine-tuning Script")
    print("=" * 60)
    
    if args.mode == "create_sample":
        create_sample_data("sample_data.json", args.task_type)
        return
    
    # Initialize trainer
    model_name = AVAILABLE_MODELS[args.model]
    trainer = IndicBERTTrainer(model_name, args.task_type)
    
    if args.mode == "inference":
        print(f"Running inference on: {args.text}")
        result = trainer.run_inference(args.text)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    elif args.mode == "fine_tune":
        if not args.data_path:
            print("Error: --data_path is required for fine-tuning mode")
            return
        
        print(f"Loading training data from: {args.data_path}")
        training_data = load_data_from_file(args.data_path)
        
        # Split data into train/validation
        train_data, val_data = train_test_split(training_data, test_size=0.2, random_state=42)
        
        hyperparameters = {
            'num_epochs': args.epochs,
            'learning_rate': args.learning_rate,
            'batch_size': args.batch_size,
            'weight_decay': 0.01,
            'warmup_steps': 500
        }
        
        print("Starting fine-tuning...")
        result = trainer.fine_tune(train_data, val_data, hyperparameters, args.output_dir)
        
        if result['success']:
            print("Fine-tuning completed successfully!")
            print(f"Model saved to: {result['output_dir']}")
        else:
            print(f"Fine-tuning failed: {result['error']}")

if __name__ == "__main__":
    main()
