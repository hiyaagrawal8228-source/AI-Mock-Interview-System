# backend/app.py
"""
AI Mock Interview API — Production v3.1
Fixed & production-ready.
"""

import os
import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routes.resume     import router as resume_router
from backend.routes.interview  import router as interview_router
from backend.routes.proctoring import router as proctoring_router
from backend.routes.user       import router as user_router
from backend.routes.dashboard  import router as dashboard_router

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "AI Mock Interview API",
    version     = "3.1.0",
    description = "Production-grade AI interview system",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins     = origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*", "X-User-Id", "X-User-Email"],
)

# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code = 500,
        content     = {"detail": "Internal server error. Please try again."},
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(user_router)
app.include_router(resume_router)
app.include_router(interview_router)
app.include_router(proctoring_router)
app.include_router(dashboard_router)

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":  "ok",
        "version": "3.1.0",
        "fixes": [
            "Resume parse fallback to regex when LLM fails",
            "Graceful Whisper/OpenCV loading",
            "Fixed report _id serialization",
            "Fixed dashboard schema field mismatches",
            "Fixed np.mean on empty lists",
            "Fixed ROUTES.SESSION missing constant",
            "Fixed vite version (8→5), removed unused heavy deps",
            "Fixed sentence-transformers lazy loading",
            "Fixed LLM max_tokens truncation",
        ],
    }

# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=True)
