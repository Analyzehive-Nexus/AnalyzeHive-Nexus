from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Analyzehive Inference Service")


class PredictRequest(BaseModel):
    input: dict | None = None


class PredictResponse(BaseModel):
    result: dict
    model: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "fastapi-inference"}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    # Placeholder only. Swap in real PyTorch/TensorRT inference once
    # models and the target GPUs are available.
    return PredictResponse(
        result={"echo": payload.input, "risk_score": 0.42},
        model="mock-v0",
    )
