from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import tempfile
import subprocess
import os
import json

router = APIRouter()

class VideoUrl(BaseModel):
    url: str

@router.post("/video_extra_data", summary="Анализ видеофайла для получения FPS и размера")
async def get_video_extra_data(item: VideoUrl):
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            temp_file_path = temp_file.name

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("GET", item.url) as response:
                response.raise_for_status()
                with open(temp_file_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)

        file_size = os.path.getsize(temp_file_path)
        size_mb = f"{file_size / (1024 * 1024):.2f} MB"

        ffprobe_cmd = [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=r_frame_rate",
            "-of", "json",
            temp_file_path,
        ]
        
        result = subprocess.run(ffprobe_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"FFprobe error: {result.stderr}")
        
        probe_data = json.loads(result.stdout)
        frame_rate_str = probe_data["streams"][0]["r_frame_rate"]
        num, den = map(int, frame_rate_str.split('/'))
        fps = round(num / den) if den != 0 else 0

        return {"fps": fps, "size_mb": size_mb}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)