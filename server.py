from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parent


def _load_dotenv(base_dir: Path) -> None:
    env_path = base_dir / ".env"
    if not env_path.exists():
        return

    try:
        raw = env_path.read_text(encoding="utf-8")
    except Exception:
        return

    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        key = k.strip()
        val = v.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = val


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = Field(..., description="대화 역할")
    content: str = Field(..., min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    input: str | None = Field(default=None, description="단일 메시지 입력(옵션)")
    model: str = Field(default="gpt-5.2")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


app = FastAPI(title="Landing Chat API")

# 로컬 개발 편의: file:// 또는 다른 포트에서 띄운 프론트도 호출 가능
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_client():
    _load_dotenv(ROOT_DIR)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "서버가 OPENAI_API_KEY를 읽지 못했습니다. "
                "PowerShell에서 $env:OPENAI_API_KEY=\"...\" 설정 후 같은 창에서 실행하거나, "
                "프로젝트 폴더에 .env 파일을 만들고 OPENAI_API_KEY=... 를 넣어주세요."
            ),
        )

    try:
        from openai import OpenAI
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"openai 패키지 로드 실패: {e!r}")

    return OpenAI(api_key=api_key)


def _to_responses_input(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for m in messages:
        items.append(
            {
                "role": m.role,
                "content": [{"type": "input_text", "text": m.content}],
            }
        )
    return items


@app.post("/api/chat")
def api_chat(req: ChatRequest):
    user_text = (req.input or "").strip()
    messages = list(req.messages)
    if user_text:
        messages.append(ChatMessage(role="user", content=user_text))

    if not messages:
        raise HTTPException(status_code=400, detail="메시지가 비어 있습니다.")

    client = _get_client()

    system = (
        "너는 H2GO(수소 거래 플랫폼) 랜딩페이지의 AI 도우미야. "
        "사용자의 질문에 짧고 친절하게 답하고, 필요한 경우 기능/이용방법/문의 안내를 제공해."
    )
    input_items: list[dict[str, Any]] = [
        {"role": "system", "content": [{"type": "input_text", "text": system}]},
        *_to_responses_input(messages),
    ]

    try:
        resp = client.responses.create(
            model=req.model,
            input=input_items,
            temperature=req.temperature,
        )
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"error": "OpenAI API 호출 실패", "detail": str(e)},
        )

    text = getattr(resp, "output_text", None) or ""
    return {"text": text}


@app.get("/api/health")
def api_health():
    return {"ok": True}


@app.post("/api/respond")
def api_respond(req: ChatRequest):
    # openai_test.js 호환용 alias
    return api_chat(req)


# 정적 파일 서빙(로컬 실행 편의)
app.mount("/", StaticFiles(directory=str(ROOT_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)

