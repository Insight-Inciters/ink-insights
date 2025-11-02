from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os, tempfile
from analysis import analyze_text
from exports import export_csv, export_pdf

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

RESULT_CACHE = {}

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".txt"):
        return JSONResponse({"error": "Only .txt files are supported"}, status_code=400)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    result = analyze_text(tmp_path)
    os.remove(tmp_path)
    RESULT_CACHE["latest"] = result
    return result

@app.get("/export/csv")
async def export_csv_file():
    if "latest" not in RESULT_CACHE:
        return JSONResponse({"error": "No results to export"}, status_code=400)
    path = export_csv(RESULT_CACHE["latest"])
    return FileResponse(path, media_type="text/csv", filename="analysis_results.csv")

@app.get("/export/pdf")
async def export_pdf_file():
    if "latest" not in RESULT_CACHE:
        return JSONResponse({"error": "No results to export"}, status_code=400)
    path = export_pdf(RESULT_CACHE["latest"])
    return FileResponse(path, media_type="application/pdf", filename="analysis_results.pdf")
