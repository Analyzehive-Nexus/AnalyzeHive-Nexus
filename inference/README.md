# Inference Service (FastAPI)

Prototype GPU inference service. Owns model loading/inference; called
by the Express backend, never directly by the frontend.

## Run

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Routes

- `GET /health`
- `POST /predict` - mock inference, replace with real PyTorch/TensorRT model calls
