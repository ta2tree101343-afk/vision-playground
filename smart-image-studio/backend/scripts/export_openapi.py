import json
import sys
from app.main import app

sys.stdout.buffer.write(
    (json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n").encode("utf-8")
)
