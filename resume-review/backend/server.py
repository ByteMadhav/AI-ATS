from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import resume_reader
import ats_check

app = FastAPI(title="ATS Resume Checker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
async def analyze_resume(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    file_bytes = await file.read()

    try:
        resume_text = resume_reader.read_resume(file_bytes)
        if not resume_text:
            raise HTTPException(
                status_code=422,
                detail="Could not extract any text from that PDF. It may be a scanned image.",
            )
        result = ats_check.check_resume(resume_text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"filename": file.filename, "result": result}


# Run with: uvicorn server:app --reload --port 8000