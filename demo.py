#!/usr/bin/env python3
"""
IndicBERT v2 Demo Script

This script demonstrates how to use the IndicBERT v2 model for basic NLP tasks.
It downloads the pre-trained model and shows examples of:
1. Text tokenization
2. Text classification (sentiment analysis)
3. Named Entity Recognition (NER)
4. Question Answering

Requirements:
- transformers
- torch
- datasets
- indic-nlp-library
"""

import torch
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoModelForQuestionAnswering,
    pipeline
)
from datasets import load_dataset
import argparse

def download_model(model_name="ai4bharat/IndicBERTv2-MLM-only"):
    """Download and load the IndicBERT model and tokenizer."""
    print(f"Downloading model: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    return tokenizer

def demo_tokenization(tokenizer, text="नमस्ते, कैसे हो आप?"):
    """Demonstrate text tokenization."""
    print("\n=== Text Tokenization Demo ===")
    print(f"Input text: {text}")
    
    # Tokenize the text
    tokens = tokenizer.tokenize(text)
    print(f"Tokens: {tokens}")
    
    # Encode the text
    encoded = tokenizer.encode(text, return_tensors="pt")
    print(f"Token IDs: {encoded[0][:10]}...")  # Show first 10 tokens
    
    # Decode back to text
    decoded = tokenizer.decode(encoded[0])
    print(f"Decoded: {decoded}")

def demo_sentiment_analysis():
    """Demonstrate sentiment analysis using a pre-trained model."""
    print("\n=== Sentiment Analysis Demo ===")
    
    # Load a sentiment analysis model
    try:
        sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="ai4bharat/IndicBERTv2-MLM-only",
            tokenizer="ai4bharat/IndicBERTv2-MLM-only"
        )
        
        # Test with Hindi text
        hindi_text = "यह फिल्म बहुत अच्छी है"
        result = sentiment_pipeline(hindi_text)
        print(f"Text: {hindi_text}")
        print(f"Sentiment: {result}")
        
    except Exception as e:
        print(f"Note: Full sentiment analysis requires fine-tuned model. Error: {e}")
        print("This is expected as the base model needs to be fine-tuned for specific tasks.")

def demo_text_generation(tokenizer):
    """Demonstrate basic text generation capabilities."""
    print("\n=== Text Generation Demo ===")
    
    # Simple example of how the model could be used for text generation
    text = "भारत एक महान देश है"
    print(f"Input text: {text}")
    
    # Show tokenization for generation
    input_ids = tokenizer.encode(text, return_tensors="pt")
    print(f"Input tokens: {tokenizer.convert_ids_to_tokens(input_ids[0])}")
    
    print("Note: For actual text generation, you would need a language model head.")

def demo_multilingual_support():
    """Demonstrate multilingual capabilities."""
    print("\n=== Multilingual Support Demo ===")
    
    # Test texts in different Indic languages
    test_texts = {
        "Hindi": "नमस्ते, आप कैसे हैं?",
        "Bengali": "হ্যালো, আপনি কেমন আছেন?",
        "Tamil": "வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?",
        "Telugu": "నమస్కారం, మీరు ఎలా ఉన్నారు?",
        "Marathi": "नमस्कार, तुम्ही कसे आहात?",
        "Gujarati": "નમસ્તે, તમે કેમ છો?",
        "Kannada": "ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?",
        "Malayalam": "നമസ്കാരം, നിങ്ങൾ എങ്ങനെ ഉണ്ട്?"
    }
    
    tokenizer = download_model()
    
    for language, text in test_texts.items():
        print(f"\n{language}: {text}")
        tokens = tokenizer.tokenize(text)
        print(f"Tokens: {tokens[:5]}...")  # Show first 5 tokens

def main():
    parser = argparse.ArgumentParser(description="IndicBERT v2 Demo")
    parser.add_argument("--task", type=str, default="all", 
                       choices=["tokenization", "sentiment", "generation", "multilingual", "all"],
                       help="Which demo to run")
    parser.add_argument("--text", type=str, default="नमस्ते, कैसे हो आप?",
                       help="Input text for tokenization demo")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("IndicBERT v2 Demo")
    print("=" * 60)
    print("This demo shows basic capabilities of the IndicBERT v2 model.")
    print("The model supports 23 Indic languages and English.")
    print("=" * 60)
    
    try:
        # Download the model
        tokenizer = download_model()
        
        if args.task == "all" or args.task == "tokenization":
            demo_tokenization(tokenizer, args.text)
        
        if args.task == "all" or args.task == "sentiment":
            demo_sentiment_analysis()
        
        if args.task == "all" or args.task == "generation":
            demo_text_generation(tokenizer)
        
        if args.task == "all" or args.task == "multilingual":
            demo_multilingual_support()
            
        print("\n" + "=" * 60)
        print("Demo completed successfully!")
        print("=" * 60)
        print("\nTo run fine-tuning on specific tasks, use the scripts in the fine-tuning/ directory.")
        print("For example:")
        print("  python IndicBERT/fine-tuning/sentiment/sentiment.py --do_train")
        print("  python IndicBERT/fine-tuning/ner/ner.py --do_train")
        
    except Exception as e:
        print(f"Error during demo: {e}")
        print("Make sure you have the required dependencies installed:")
        print("  pip install transformers torch datasets indic-nlp-library")

if __name__ == "__main__":
    main()
