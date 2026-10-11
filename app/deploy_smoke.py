"""Read-only HTTP checks against the newly deployed web container."""
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

for path in ("/", "/login"):
    with urlopen("http://127.0.0.1" + path, timeout=5) as response:
        assert response.status == 200

request = Request(
    "http://127.0.0.1/login",
    data=json.dumps({"email": f"deploy-{uuid4()}@example.invalid", "password": "invalid"}).encode(),
    headers={"Content-Type": "application/json"},
)
try:
    urlopen(request, timeout=5)
except HTTPError as error:
    if error.code != 401:
        raise
else:
    raise RuntimeError("Login must reject nonexistent users with HTTP 401")
