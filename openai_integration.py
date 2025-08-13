#!/usr/bin/env python3
"""
OpenAI Integration for IndicBERT v2 Chat System

This module handles:
1. OpenAI API integration for fallback responses
2. Query routing between fine-tuned model and OpenAI
3. Response quality assessment
4. Cost management and rate limiting
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import openai
from openai import OpenAI
import time
import hashlib
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAIHandler:
    """Handles OpenAI API integration and query management."""
    
    def __init__(self, api_key: str = None, model: str = "gpt-3.5-turbo"):
        """Initialize OpenAI handler."""
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        
        self.model = model
        self.client = OpenAI(api_key=self.api_key)
        
        # Rate limiting and cost management
        self.rate_limit = {
            'requests_per_minute': 60,
            'tokens_per_minute': 90000,
            'last_request_time': 0,
            'request_count': 0
        }
        
        # Cost tracking (approximate)
        self.cost_tracking = {
            'total_cost': 0.0,
            'total_tokens': 0,
            'daily_cost': 0.0,
            'last_reset_date': datetime.now().date()
        }
        
        # Response cache to reduce API calls
        self.response_cache = {}
        self.cache_ttl = 3600  # 1 hour
        
        # Initialize cost tracking
        self._init_cost_tracking()
    
    def _init_cost_tracking(self):
        """Initialize cost tracking from environment or defaults."""
        # Cost per 1K tokens (approximate, may vary)
        self.cost_per_1k_tokens = {
            'gpt-3.5-turbo': 0.002,
            'gpt-4': 0.03,
            'gpt-4-turbo': 0.01
        }
    
    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits."""
        current_time = time.time()
        
        # Reset counter if minute has passed
        if current_time - self.rate_limit['last_request_time'] >= 60:
            self.rate_limit['request_count'] = 0
            self.rate_limit['last_request_time'] = current_time
        
        # Check if we're within limits
        if self.rate_limit['request_count'] >= self.rate_limit['requests_per_minute']:
            return False
        
        return True
    
    def _wait_for_rate_limit(self):
        """Wait if rate limit is exceeded."""
        while not self._check_rate_limit():
            time.sleep(1)
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate the cost of an API call."""
        if self.model not in self.cost_per_1k_tokens:
            return 0.0
        
        cost_per_1k = self.cost_per_1k_tokens[self.model]
        total_tokens = input_tokens + output_tokens
        cost = (total_tokens / 1000) * cost_per_1k
        
        return cost
    
    def _update_cost_tracking(self, input_tokens: int, output_tokens: int, cost: float):
        """Update cost tracking."""
        # Reset daily cost if it's a new day
        current_date = datetime.now().date()
        if current_date != self.cost_tracking['last_reset_date']:
            self.cost_tracking['daily_cost'] = 0.0
            self.cost_tracking['last_reset_date'] = current_date
        
        self.cost_tracking['total_cost'] += cost
        self.cost_tracking['daily_cost'] += cost
        self.cost_tracking['total_tokens'] += (input_tokens + output_tokens)
    
    def _get_cache_key(self, query: str, context: str = "") -> str:
        """Generate cache key for query."""
        cache_string = f"{query}:{context}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _get_cached_response(self, cache_key: str) -> Optional[Dict]:
        """Get cached response if available and not expired."""
        if cache_key in self.response_cache:
            cached_item = self.response_cache[cache_key]
            if time.time() - cached_item['timestamp'] < self.cache_ttl:
                return cached_item['response']
            else:
                # Remove expired cache entry
                del self.response_cache[cache_key]
        return None
    
    def _cache_response(self, cache_key: str, response: Dict):
        """Cache the response."""
        self.response_cache[cache_key] = {
            'response': response,
            'timestamp': time.time()
        }
        
        # Limit cache size
        if len(self.response_cache) > 1000:
            # Remove oldest entries
            oldest_keys = sorted(
                self.response_cache.keys(),
                key=lambda k: self.response_cache[k]['timestamp']
            )[:100]
            for key in oldest_keys:
                del self.response_cache[key]
    
    def _should_use_openai(self, query: str, fine_tuned_response: str = None) -> Tuple[bool, str]:
        """
        Determine if OpenAI should be used for this query.
        Returns (should_use, reason)
        """
        # Check if query is in English or common languages
        query_lower = query.lower()
        
        # If fine-tuned response is empty or very short, use OpenAI
        if not fine_tuned_response or len(fine_tuned_response.strip()) < 20:
            return True, "Fine-tuned response insufficient"
        
        # Check for specific query types that might need OpenAI
        openai_keywords = [
            'explain', 'how to', 'what is', 'why', 'compare', 'analyze',
            'step by step', 'tutorial', 'guide', 'example', 'code',
            'programming', 'algorithm', 'complex', 'advanced'
        ]
        
        for keyword in openai_keywords:
            if keyword in query_lower:
                return True, f"Query contains '{keyword}' - may need detailed explanation"
        
        # Check for technical or domain-specific queries
        technical_domains = [
            'python', 'javascript', 'java', 'c++', 'machine learning',
            'deep learning', 'neural network', 'api', 'database', 'sql',
            'docker', 'kubernetes', 'aws', 'azure', 'gcp'
        ]
        
        for domain in technical_domains:
            if domain in query_lower:
                return True, f"Technical domain '{domain}' detected"
        
        # If query is very specific or complex, use OpenAI
        if len(query.split()) > 10:
            return True, "Complex query - may need OpenAI's capabilities"
        
        return False, "Query suitable for fine-tuned model"
    
    def _create_system_prompt(self, language: str = "english") -> str:
        """Create system prompt for OpenAI based on language."""
        base_prompt = """You are an AI assistant that specializes in Indic languages and cultures. 
        You should provide helpful, accurate, and culturally appropriate responses.
        
        Key guidelines:
        1. If the user asks in an Indic language, respond in the same language
        2. Be respectful of cultural sensitivities
        3. Provide accurate and helpful information
        4. If you're unsure about something, say so rather than guessing
        5. Keep responses concise but informative
        """
        
        if language != "english":
            language_prompts = {
                "hindi": "आप हिंदी में जवाब दें। आपका जवाब स्पष्ट और उपयोगी होना चाहिए।",
                "bengali": "আপনি বাংলায় উত্তর দিন। আপনার উত্তর স্পষ্ট এবং সহায়ক হওয়া উচিত।",
                "tamil": "நீங்கள் தமிழில் பதிலளிக்கவும். உங்கள் பதில் தெளிவாகவும் பயனுள்ளதாகவும் இருக்க வேண்டும்.",
                "telugu": "మీరు తెలుగులో సమాధానం ఇవ్వండి. మీ సమాధానం స్పష్టంగా మరియు ఉపయోగకరంగా ఉండాలి.",
                "marathi": "तुम्ही मराठीत उत्तर द्या. तुमचे उत्तर स्पष्ट आणि उपयुक्त असले पाहिजे."
            }
            base_prompt += f"\n\n{language_prompts.get(language, '')}"
        
        return base_prompt
    
    def _detect_language(self, text: str) -> str:
        """Detect the language of the input text."""
        # Simple language detection based on script
        if re.search(r'[\u0900-\u097F]', text):  # Devanagari
            return "hindi"
        elif re.search(r'[\u0980-\u09FF]', text):  # Bengali
            return "bengali"
        elif re.search(r'[\u0B80-\u0BFF]', text):  # Tamil
            return "tamil"
        elif re.search(r'[\u0C00-\u0C7F]', text):  # Telugu
            return "telugu"
        elif re.search(r'[\u0A80-\u0AFF]', text):  # Gujarati
            return "gujarati"
        elif re.search(r'[\u0C80-\u0CFF]', text):  # Kannada
            return "kannada"
        elif re.search(r'[\u0D00-\u0D7F]', text):  # Malayalam
            return "malayalam"
        elif re.search(r'[\u0A00-\u0A7F]', text):  # Gurmukhi
            return "punjabi"
        elif re.search(r'[\u0B00-\u0B7F]', text):  # Odia
            return "odia"
        else:
            return "english"
    
    def query_openai(self, query: str, context: str = "", 
                    fine_tuned_response: str = None) -> Dict:
        """
        Query OpenAI API for a response.
        
        Args:
            query: User's question
            context: Additional context or conversation history
            fine_tuned_response: Response from fine-tuned model (if available)
        
        Returns:
            Dictionary containing response and metadata
        """
        try:
            # Check rate limits
            self._wait_for_rate_limit()
            
            # Check cache first
            cache_key = self._get_cache_key(query, context)
            cached_response = self._get_cached_response(cache_key)
            if cached_response:
                logger.info("Using cached OpenAI response")
                return cached_response
            
            # Determine if we should use OpenAI
            should_use, reason = self._should_use_openai(query, fine_tuned_response)
            
            if not should_use:
                return {
                    'success': False,
                    'reason': reason,
                    'recommendation': 'Use fine-tuned model response'
                }
            
            # Detect language
            detected_language = self._detect_language(query)
            
            # Create system prompt
            system_prompt = self._create_system_prompt(detected_language)
            
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add context if available
            if context:
                messages.append({
                    "role": "user", 
                    "content": f"Context: {context}\n\nQuestion: {query}"
                })
            else:
                messages.append({"role": "user", "content": query})
            
            # Add fine-tuned response for comparison if available
            if fine_tuned_response:
                messages.append({
                    "role": "assistant",
                    "content": f"Fine-tuned model response: {fine_tuned_response}"
                })
                messages.append({
                    "role": "user",
                    "content": "Please provide a comprehensive answer that builds upon or corrects the fine-tuned model response if needed."
                })
            
            # Make API call
            logger.info(f"Querying OpenAI for: {query[:100]}...")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=1000,
                temperature=0.7,
                top_p=0.9
            )
            
            # Extract response
            ai_response = response.choices[0].message.content
            usage = response.usage
            
            # Calculate cost
            cost = self._calculate_cost(usage.prompt_tokens, usage.completion_tokens)
            self._update_cost_tracking(usage.prompt_tokens, usage.completion_tokens, cost)
            
            # Update rate limit counter
            self.rate_limit['request_count'] += 1
            
            # Prepare result
            result = {
                'success': True,
                'response': ai_response,
                'model': self.model,
                'language': detected_language,
                'usage': {
                    'prompt_tokens': usage.prompt_tokens,
                    'completion_tokens': usage.completion_tokens,
                    'total_tokens': usage.total_tokens
                },
                'cost': cost,
                'reason': reason,
                'timestamp': datetime.now().isoformat()
            }
            
            # Cache the response
            self._cache_response(cache_key, result)
            
            logger.info(f"OpenAI response generated successfully. Cost: ${cost:.4f}")
            return result
            
        except openai.RateLimitError:
            logger.warning("OpenAI rate limit exceeded")
            return {
                'success': False,
                'error': 'Rate limit exceeded. Please try again later.',
                'retry_after': 60
            }
        
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return {
                'success': False,
                'error': f'OpenAI API error: {str(e)}'
            }
        
        except Exception as e:
            logger.error(f"Unexpected error querying OpenAI: {e}")
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }
    
    def get_cost_summary(self) -> Dict:
        """Get cost summary and usage statistics."""
        return {
            'total_cost': round(self.cost_tracking['total_cost'], 4),
            'daily_cost': round(self.cost_tracking['daily_cost'], 4),
            'total_tokens': self.cost_tracking['total_tokens'],
            'average_cost_per_request': round(
                self.cost_tracking['total_cost'] / max(self.rate_limit['request_count'], 1), 
                4
            ),
            'last_reset_date': self.cost_tracking['last_reset_date'].isoformat()
        }
    
    def reset_daily_cost(self):
        """Reset daily cost counter."""
        self.cost_tracking['daily_cost'] = 0.0
        self.cost_tracking['last_reset_date'] = datetime.now().date()
        logger.info("Daily cost counter reset")
    
    def clear_cache(self):
        """Clear response cache."""
        self.response_cache.clear()
        logger.info("Response cache cleared")

class QueryRouter:
    """Routes queries between fine-tuned model and OpenAI based on various factors."""
    
    def __init__(self, openai_handler: OpenAIHandler):
        """Initialize query router."""
        self.openai_handler = openai_handler
        self.routing_rules = {
            'confidence_threshold': 0.7,
            'response_length_threshold': 50,
            'domain_specific_keywords': [
                'programming', 'code', 'algorithm', 'technical', 'complex',
                'explanation', 'tutorial', 'guide', 'how to', 'step by step'
            ]
        }
    
    def route_query(self, query: str, fine_tuned_response: str = None, 
                   fine_tuned_confidence: float = None) -> Dict:
        """
        Route a query to the appropriate model.
        
        Returns:
            Dictionary with routing decision and response
        """
        try:
            # First, try to get response from fine-tuned model
            if not fine_tuned_response:
                return {
                    'routing_decision': 'openai_only',
                    'reason': 'No fine-tuned model available',
                    'response_source': 'openai'
                }
            
            # Evaluate fine-tuned response quality
            quality_score = self._evaluate_response_quality(
                query, fine_tuned_response, fine_tuned_confidence
            )
            
            # Determine routing strategy
            if quality_score >= self.routing_rules['confidence_threshold']:
                # Fine-tuned model response is good enough
                return {
                    'routing_decision': 'fine_tuned_only',
                    'reason': f'High quality response (score: {quality_score:.2f})',
                    'response_source': 'fine_tuned',
                    'quality_score': quality_score
                }
            
            elif quality_score >= 0.3:
                # Use both models - fine-tuned as base, OpenAI for enhancement
                openai_response = self.openai_handler.query_openai(
                    query, fine_tuned_response=fine_tuned_response
                )
                
                if openai_response['success']:
                    return {
                        'routing_decision': 'hybrid',
                        'reason': f'Medium quality fine-tuned response enhanced by OpenAI',
                        'response_source': 'hybrid',
                        'fine_tuned_response': fine_tuned_response,
                        'openai_response': openai_response['response'],
                        'quality_score': quality_score
                    }
                else:
                    # Fallback to fine-tuned only if OpenAI fails
                    return {
                        'routing_decision': 'fine_tuned_fallback',
                        'reason': 'OpenAI failed, using fine-tuned response',
                        'response_source': 'fine_tuned',
                        'quality_score': quality_score
                    }
            
            else:
                # Fine-tuned response is poor, use OpenAI
                openai_response = self.openai_handler.query_openai(query)
                
                if openai_response['success']:
                    return {
                        'routing_decision': 'openai_only',
                        'reason': f'Poor fine-tuned response quality (score: {quality_score:.2f})',
                        'response_source': 'openai',
                        'quality_score': quality_score
                    }
                else:
                    # Last resort - use fine-tuned response
                    return {
                        'routing_decision': 'fine_tuned_last_resort',
                        'reason': 'OpenAI failed, using fine-tuned response as last resort',
                        'response_source': 'fine_tuned',
                        'quality_score': quality_score
                    }
        
        except Exception as e:
            logger.error(f"Error in query routing: {e}")
            return {
                'routing_decision': 'error',
                'reason': f'Routing error: {str(e)}',
                'response_source': 'error'
            }
    
    def _evaluate_response_quality(self, query: str, response: str, 
                                 confidence: float = None) -> float:
        """
        Evaluate the quality of a fine-tuned model response.
        
        Returns:
            Quality score between 0 and 1
        """
        try:
            score = 0.0
            
            # Length-based scoring
            if len(response.strip()) >= self.routing_rules['response_length_threshold']:
                score += 0.2
            
            # Relevance scoring (simple keyword matching)
            query_words = set(query.lower().split())
            response_words = set(response.lower().split())
            common_words = query_words.intersection(response_words)
            
            if len(query_words) > 0:
                relevance_score = len(common_words) / len(query_words)
                score += relevance_score * 0.3
            
            # Confidence scoring (if available)
            if confidence is not None:
                score += confidence * 0.3
            
            # Domain-specific scoring
            domain_score = 0.0
            for keyword in self.routing_rules['domain_specific_keywords']:
                if keyword in query.lower():
                    if keyword in response.lower():
                        domain_score += 0.1
            
            score += min(domain_score, 0.2)
            
            # Normalize score to 0-1 range
            return min(score, 1.0)
            
        except Exception as e:
            logger.warning(f"Error evaluating response quality: {e}")
            return 0.5  # Default medium quality

# Global instances
openai_handler = None
query_router = None

def get_openai_handler(api_key: str = None) -> OpenAIHandler:
    """Get global OpenAI handler instance."""
    global openai_handler
    if openai_handler is None:
        openai_handler = OpenAIHandler(api_key)
    return openai_handler

def get_query_router(openai_handler: OpenAIHandler = None) -> QueryRouter:
    """Get global query router instance."""
    global query_router
    if query_router is None:
        if openai_handler is None:
            openai_handler = get_openai_handler()
        query_router = QueryRouter(openai_handler)
    return query_router
