import requests
import json

url = "http://127.0.0.1:8000/predict/demand"
payload = {
    "data_window": [
        [75, 50, 0.15, 20, 2, 100, 5, 10, 45, 150, 12, 50, 25, 0, 1, 1, 1, 0, 0, 1, 1, 12]
    ] * 6
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
