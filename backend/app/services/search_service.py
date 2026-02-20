"""
Elasticsearch Search Service
Provides advanced full-text search capabilities for acharyas
"""
from elasticsearch import AsyncElasticsearch
from typing import List, Dict, Any, Optional
import logging
import json

logger = logging.getLogger(__name__)


class SearchService:
    """
    Advanced search service using Elasticsearch
    Provides full-text search, filtering, and relevance ranking
    """

    def __init__(self, es_url: str = "http://localhost:9200"):
        self.es = AsyncElasticsearch([es_url])
        self.index_name = "acharyas"

    async def create_index(self):
        """Create Elasticsearch index with proper mappings"""
        mappings = {
            "properties": {
                "user_id": {"type": "keyword"},
                "name": {"type": "text", "analyzer": "standard"},
                "bio": {"type": "text", "analyzer": "standard"},
                "specializations": {"type": "keyword"},
                "languages": {"type": "keyword"},
                "experience_years": {"type": "integer"},
                "hourly_rate": {"type": "float"},
                "ratings": {
                    "properties": {
                        "average": {"type": "float"},
                        "count": {"type": "integer"},
                    }
                },
                "location": {
                    "properties": {
                        "city": {"type": "keyword"},
                        "state": {"type": "keyword"},
                        "coordinates": {"type": "geo_point"},
                    }
                },
                "total_bookings": {"type": "integer"},
                "is_verified": {"type": "boolean"},
                "created_at": {"type": "date"},
                "updated_at": {"type": "date"},
            }
        }

        try:
            if not await self.es.indices.exists(index=self.index_name):
                await self.es.indices.create(
                    index=self.index_name, body={"mappings": mappings}
                )
                logger.info(f"Created Elasticsearch index: {self.index_name}")
        except Exception as e:
            logger.error(f"Failed to create index: {e}")

    async def index_acharya(self, acharya_data: Dict[str, Any]):
        """Index a single acharya profile"""
        try:
            doc_id = str(acharya_data.get("_id", acharya_data.get("user_id")))
            await self.es.index(
                index=self.index_name, id=doc_id, body=acharya_data, refresh="wait_for"
            )
            logger.debug(f"Indexed acharya: {doc_id}")
        except Exception as e:
            logger.error(f"Failed to index acharya: {e}")

    async def bulk_index_acharyas(self, acharyas: List[Dict[str, Any]]):
        """Bulk index multiple acharya profiles"""
        try:
            from elasticsearch.helpers import async_bulk

            actions = [
                {
                    "_index": self.index_name,
                    "_id": str(acharya.get("_id", acharya.get("user_id"))),
                    "_source": acharya,
                }
                for acharya in acharyas
            ]

            success, failed = await async_bulk(self.es, actions)
            logger.info(f"Bulk indexed {success} acharyas, {failed} failed")
        except Exception as e:
            logger.error(f"Bulk indexing failed: {e}")

    @staticmethod
    def _build_filter_clauses(
        filters: Dict[str, Any], location: Optional[Dict[str, Any]] = None
    ) -> list:
        """Build Elasticsearch filter clauses from search filters."""
        RATINGS_AVERAGE = "ratings.average"
        filter_clauses = []

        # Simple term filters
        term_mappings = {
            "city": "location.city",
            "state": "location.state",
        }
        for key, field in term_mappings.items():
            if filters.get(key):
                filter_clauses.append({"term": {field: filters[key]}})

        # Array term filters
        for key in ("specializations", "languages"):
            if filters.get(key):
                vals = (
                    filters[key] if isinstance(filters[key], list) else [filters[key]]
                )
                filter_clauses.append({"terms": {key: vals}})

        # Range filters
        range_mappings = [
            ("min_rating", RATINGS_AVERAGE, "gte"),
            ("max_rating", RATINGS_AVERAGE, "lte"),
            ("min_price", "hourly_rate", "gte"),
            ("max_price", "hourly_rate", "lte"),
            ("min_experience", "experience_years", "gte"),
        ]
        for filter_key, field, comparator in range_mappings:
            if filters.get(filter_key):
                filter_clauses.append(
                    {"range": {field: {comparator: filters[filter_key]}}}
                )

        if filters.get("is_verified"):
            filter_clauses.append({"term": {"is_verified": True}})

        # Location-based filter
        if location and location.get("lat") and location.get("lon"):
            filter_clauses.append(
                {
                    "geo_distance": {
                        "distance": location.get("distance", "10km"),
                        "location.coordinates": {
                            "lat": location["lat"],
                            "lon": location["lon"],
                        },
                    }
                }
            )

        return filter_clauses

    async def search_acharyas(
        self,
        query: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        location: Optional[Dict[str, Any]] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "relevance",
    ) -> Dict[str, Any]:
        """
        Advanced acharya search with multiple filters

        Args:
            query: Search query string
            filters: Dictionary of filters (city, specializations, min_rating, etc.)
            location: Location for proximity search {"lat": 19.0760, "lon": 72.8777, "distance": "10km"}
            page: Page number
            limit: Results per page
            sort_by: Sort option (relevance, rating, price_low, price_high, experience)

        Returns:
            Search results with pagination metadata
        """
        filters = filters or {}

        # Build Elasticsearch query
        must_clauses = []

        # Text search
        if query:
            must_clauses.append(
                {
                    "multi_match": {
                        "query": query,
                        "fields": ["name^3", "bio^2", "specializations^2", "languages"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                }
            )

        filter_clauses = self._build_filter_clauses(filters, location)

        # Build final query
        search_query = {
            "bool": {
                "must": must_clauses if must_clauses else [{"match_all": {}}],
                "filter": filter_clauses,
            }
        }

        # Sorting
        sort_options = {
            "relevance": "_score",
            "rating": [{"ratings.average": {"order": "desc"}}, "_score"],
            "price_low": [{"hourly_rate": {"order": "asc"}}, "_score"],
            "price_high": [{"hourly_rate": {"order": "desc"}}, "_score"],
            "experience": [{"experience_years": {"order": "desc"}}, "_score"],
            "bookings": [{"total_bookings": {"order": "desc"}}, "_score"],
        }

        sort = sort_options.get(sort_by, "_score")

        # Execute search
        from_param = (page - 1) * limit

        try:
            response = await self.es.search(
                index=self.index_name,
                body={
                    "query": search_query,
                    "sort": sort,
                    "from": from_param,
                    "size": limit,
                    "track_total_hits": True,
                },
            )

            hits = response["hits"]
            total = hits["total"]["value"]

            results = [
                {**hit["_source"], "_score": hit["_score"], "_id": hit["_id"]}
                for hit in hits["hits"]
            ]

            return {
                "results": results,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit,
                },
                "query": query,
                "filters": filters,
            }
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "results": [],
                "pagination": {"page": page, "limit": limit, "total": 0, "pages": 0},
                "error": str(e),
            }

    async def suggest_acharyas(self, partial_text: str, limit: int = 5) -> List[str]:
        """Get autocomplete suggestions for acharya search"""
        try:
            response = await self.es.search(
                index=self.index_name,
                body={
                    "suggest": {
                        "acharya-suggest": {
                            "prefix": partial_text,
                            "completion": {"field": "name.suggest", "size": limit},
                        }
                    }
                },
            )

            suggestions = response["suggest"]["acharya-suggest"][0]["options"]
            return [s["text"] for s in suggestions]
        except Exception as e:
            logger.error(f"Autocomplete failed: {e}")
            return []

    async def delete_acharya(self, acharya_id: str):
        """Remove acharya from search index"""
        try:
            await self.es.delete(index=self.index_name, id=acharya_id)
            logger.info(f"Deleted acharya from index: {acharya_id}")
        except Exception as e:
            logger.error(f"Failed to delete acharya: {e}")

    async def close(self):
        """Close Elasticsearch connection"""
        await self.es.close()


# Singleton instance - pick up ELASTICSEARCH_HOSTS from settings
def _make_search_service() -> "SearchService":
    try:
        from app.core.config import settings
        hosts_raw = settings.ELASTICSEARCH_HOSTS or "http://localhost:9200"
        # Handle both plain URL ("http://es:9200") and JSON-array string ('["http://..."]')
        if hosts_raw.strip().startswith("["):
            hosts = json.loads(hosts_raw)
        else:
            hosts = [hosts_raw]
        return SearchService(es_url=hosts[0])
    except Exception:
        return SearchService()


search_service = _make_search_service()
