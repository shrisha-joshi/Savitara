"""
Load Testing Suite using Locust
Tests API performance under load
"""
from locust import HttpUser, task, between, events
import json
import random
from datetime import datetime, timedelta

class SavitaraUser(HttpUser):
    """
    Simulates user behavior on Savitara platform
    Tests various endpoints under load
    """
    
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    def on_start(self):
        """Login and setup before starting tasks"""
        # Simulate login
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": f"test_{random.randint(1, 1000)}@example.com",
                "password": "testpassword123"
            },
            catch_response=True
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("data", {}).get("access_token", "")
            self.headers = {"Authorization": f"Bearer {self.token}"}
            response.success()
        else:
            # Use dummy token for testing
            self.token = "test_token"
            self.headers = {"Authorization": f"Bearer {self.token}"}
            response.failure("Login failed")
    
    @task(5)
    def search_acharyas(self):
        """Test acharya search endpoint (most common operation)"""
        cities = ["Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad"]
        city = random.choice(cities)
        min_rating = random.choice([0, 3.5, 4.0, 4.5])
        
        with self.client.get(
            f"/api/v1/users/acharyas/search",
            params={
                "city": city,
                "min_rating": min_rating,
                "page": 1,
                "limit": 20
            },
            headers=self.headers,
            catch_response=True,
            name="/api/v1/users/acharyas/search"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Search failed: {response.status_code}")
    
    @task(3)
    def view_acharya_profile(self):
        """Test viewing acharya profile"""
        # Use a dummy acharya ID
        acharya_id = f"acharya_{random.randint(1, 100)}"
        
        with self.client.get(
            f"/api/v1/users/acharyas/{acharya_id}",
            headers=self.headers,
            catch_response=True,
            name="/api/v1/users/acharyas/{id}"
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Profile view failed: {response.status_code}")
    
    @task(2)
    def create_booking(self):
        """Test booking creation"""
        booking_date = (datetime.now() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
        
        booking_data = {
            "acharya_id": f"acharya_{random.randint(1, 100)}",
            "pooja_id": f"pooja_{random.randint(1, 50)}",
            "date": booking_date,
            "time": f"{random.randint(6, 20):02d}:00",
            "booking_type": random.choice(["with_samagri", "without_samagri"]),
            "location": {
                "address": "Test Address",
                "city": random.choice(["Mumbai", "Delhi", "Bangalore"]),
                "state": "Maharashtra",
                "pincode": "400001"
            }
        }
        
        with self.client.post(
            "/api/v1/bookings",
            json=booking_data,
            headers=self.headers,
            catch_response=True,
            name="/api/v1/bookings [POST]"
        ) as response:
            if response.status_code in [201, 400, 409]:  # 400/409 are expected validation errors
                response.success()
            else:
                response.failure(f"Booking creation failed: {response.status_code}")
    
    @task(2)
    def list_user_bookings(self):
        """Test listing user's bookings"""
        with self.client.get(
            "/api/v1/bookings",
            params={"page": 1, "limit": 10},
            headers=self.headers,
            catch_response=True,
            name="/api/v1/bookings [GET]"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"List bookings failed: {response.status_code}")
    
    @task(1)
    def get_user_profile(self):
        """Test getting user profile"""
        with self.client.get(
            "/api/v1/users/me",
            headers=self.headers,
            catch_response=True,
            name="/api/v1/users/me"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get profile failed: {response.status_code}")
    
    @task(1)
    def health_check(self):
        """Test health check endpoint"""
        with self.client.get(
            "/health",
            catch_response=True,
            name="/health"
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")


# Custom event handlers for detailed metrics
@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Log slow requests"""
    if response_time > 2000:  # Slower than 2 seconds
        print(f"SLOW REQUEST: {name} took {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts"""
    print("Load test starting...")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops"""
    print("Load test completed")
    
    # Print summary statistics
    stats = environment.stats
    print(f"\n{'='*80}")
    print(f"LOAD TEST SUMMARY")
    print(f"{'='*80}")
    print(f"Total Requests: {stats.total.num_requests}")
    print(f"Total Failures: {stats.total.num_failures}")
    print(f"Average Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Min Response Time: {stats.total.min_response_time:.2f}ms")
    print(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests/sec: {stats.total.current_rps:.2f}")
    print(f"{'='*80}\n")


# Run with:
# locust -f backend/tests/load/locustfile.py --host=http://localhost:8000

# For headless mode with specific users and duration:
# locust -f backend/tests/load/locustfile.py --host=http://localhost:8000 \
#        --users 100 --spawn-rate 10 --run-time 5m --headless
