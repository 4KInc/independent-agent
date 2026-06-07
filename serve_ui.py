"""Entrypoint for the combined UI + API server.

Serves the FastAPI backend at /api/* and the Vite-built frontend at /*.
Next.js static export puts pages at /<route>.html — this serves them
at /<route> for clean URLs.
"""

import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from server.app import app

static_dir = Path(__file__).parent / "static"

if static_dir.exists():
    # Serve Next.js pages at clean URLs (e.g. /resources → resources.html)
    # Falls back to index.html for client-side routing
    @app.get("/{page_name}")
    async def serve_page(page_name: str, request: Request):
        # Skip API and static asset routes
        if page_name.startswith("_next") or page_name.startswith("api"):
            return HTMLResponse(status_code=404, content="Not found")
        html_file = static_dir / f"{page_name}.html"
        if html_file.exists():
            return FileResponse(html_file, media_type="text/html")
        # SPA fallback: serve index.html and let Next.js client router handle it
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file, media_type="text/html")
        return HTMLResponse(status_code=404, content="Not found")

    # Mount static files for assets (_next/, etc.) and index.html
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
