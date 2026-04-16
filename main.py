import logging
from dotenv import load_dotenv
from fastapi import FastAPI, Request

load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routers import upload, scores, admin

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="scoredp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(scores.router)
app.include_router(admin.router)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/c")
def get_crawler(request: Request):
    api_base = str(request.base_url).rstrip("/")
    if not api_base.startswith("http://127.") and not api_base.startswith("http://localhost"):
        api_base = api_base.replace("http://", "https://")
    with open("static/crawler.js", encoding="utf-8") as f:
        js = f.read()
    js = f"window._scoredpApiBase='{api_base}';\n" + js
    return Response(content=js, media_type="application/javascript")