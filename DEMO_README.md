# IndicBERT v2 Demo

This demo showcases the IndicBERT v2 model, a multilingual language model for Indic languages. The model supports 23 Indic languages and English.

## What is IndicBERT v2?

IndicBERT v2 is a state-of-the-art multilingual language model trained on IndicCorp v2 and evaluated on the IndicXTREME benchmark. It has 278M parameters and supports:

- **23 Indic languages**: Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Kashmiri, Konkani, Manipuri, Nepali, Sanskrit, Sindhi, Urdu, and more
- **English**: For cross-lingual understanding

## Quick Start

### Option 1: Automatic Setup and Run
```bash
python run_demo.py
```

This will automatically:
1. Install all required dependencies
2. Download the IndicBERT v2 model
3. Run demonstrations of various NLP tasks

### Option 2: Manual Setup
```bash
# Install dependencies
pip install -r demo_requirements.txt

# Run the demo
python demo.py
```

## What the Demo Shows

The demo demonstrates:

1. **Text Tokenization**: How IndicBERT tokenizes text in various Indic languages
2. **Multilingual Support**: Examples in 8 different Indic languages
3. **Model Capabilities**: Basic understanding of the model's architecture

## Demo Options

You can run specific parts of the demo:

```bash
# Run only tokenization demo
python demo.py --task tokenization --text "नमस्ते, कैसे हो आप?"

# Run only multilingual support demo
python demo.py --task multilingual

# Run all demos (default)
python demo.py --task all
```

## Example Output

```
============================================================
IndicBERT v2 Demo
============================================================
This demo shows basic capabilities of the IndicBERT v2 model.
The model supports 23 Indic languages and English.
============================================================

Downloading model: ai4bharat/IndicBERTv2-MLM-only

=== Text Tokenization Demo ===
Input text: नमस्ते, कैसे हो आप?
Tokens: ['नमस्ते', ',', 'कैसे', 'हो', 'आप', '?']
Token IDs: tensor([2, 1234, 5678, 9012, 3456, 7890, 3])...
Decoded: नमस्ते, कैसे हो आप?

=== Multilingual Support Demo ===

Hindi: नमस्ते, आप कैसे हैं?
Tokens: ['नमस्ते', ',', 'आप', 'कैसे', 'हैं']...

Bengali: হ্যালো, আপনি কেমন আছেন?
Tokens: ['হ্যালো', ',', 'আপনি', 'কেমন', 'আছেন']...
```

## Advanced Usage

### Fine-tuning for Specific Tasks

The IndicBERT repository includes fine-tuning scripts for various NLP tasks:

```bash
# Sentiment Analysis
python IndicBERT/fine-tuning/sentiment/sentiment.py --do_train

# Named Entity Recognition (NER)
python IndicBERT/fine-tuning/ner/ner.py --do_train

# Question Answering
python IndicBERT/fine-tuning/qa/qa.py --do_train

# Text Classification (XNLI)
python IndicBERT/fine-tuning/xnli/xnli.py --do_train
```

### Available Models

- **IndicBERTv2-MLM-only**: Base model trained with MLM objective
- **IndicBERTv2-MLM-Sam-TLM**: Model with additional TLM objective using Samanantar corpus
- **IndicBERTv2-MLM-Back-TLM**: Model with TLM objective using back-translation
- **IndicBERTv2-SS**: Script-shared model (converts scripts to Devanagari)

## Requirements

- Python 3.7+
- PyTorch
- Transformers
- Datasets
- Indic-NLP-Library

## Troubleshooting

1. **Model Download Issues**: Make sure you have a stable internet connection
2. **Memory Issues**: The model is ~1GB, ensure sufficient RAM
3. **CUDA Issues**: The demo works on CPU, but GPU acceleration requires CUDA setup

## Learn More

- [Paper](https://arxiv.org/abs/2212.05409)
- [HuggingFace Models](https://huggingface.co/ai4bharat/IndicBERTv2-MLM-only)
- [IndicXTREME Benchmark](https://github.com/AI4Bharat/IndicXTREME)
- [IndicCorp v2 Dataset](https://huggingface.co/datasets/ai4bharat/IndicCorpV2)

## Citation

```bibtex
@inproceedings{doddapaneni-etal-2023-towards,
    title = "Towards Leaving No {I}ndic Language Behind: Building Monolingual Corpora, Benchmark and Models for {I}ndic Languages",
    author = "Doddapaneni, Sumanth and Aralikatte, Rahul and Ramesh, Gowtham and Goyal, Shreya and Khapra, Mitesh M. and Kunchukuttan, Anoop and Kumar, Pratyush",
    booktitle = "Proceedings of ACL 2023",
    year = "2023"
}
```
