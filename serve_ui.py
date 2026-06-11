"""Entrypoint for the combined UI + API server.

Serves the FastAPI backend at /api/* and the Vite-built frontend at /*.
Next.js static export puts pages at /<route>.html — this serves them
at /<route> for clean URLs.
"""

import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.staticfiles import StaticFiles

from server.app import app

static_dir = Path(__file__).parent / "static"


class NoCacheHTMLMiddleware(BaseHTTPMiddleware):
    """Prevent browsers from caching HTML pages so they always get fresh JS chunk references."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        ct = response.headers.get("content-type", "")
        if "text/html" in ct:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


app.add_middleware(NoCacheHTMLMiddleware)

if static_dir.exists():
    @app.get("/")
    async def serve_root():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file, media_type="text/html")
        return HTMLResponse(status_code=404, content="Not found")

    @app.get("/{page_name}")
    async def serve_page(page_name: str, request: Request):
        if page_name.startswith("_next") or page_name.startswith("api"):
            return HTMLResponse(status_code=404, content="Not found")
        html_file = static_dir / f"{page_name}.html"
        if html_file.exists():
            return FileResponse(html_file, media_type="text/html")
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file, media_type="text/html")
        return HTMLResponse(status_code=404, content="Not found")

    # NO html=True — prevents SPA fallback from serving index.html for JS/CSS chunks
    app.mount("/", StaticFiles(directory=str(static_dir)), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
