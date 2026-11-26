import uvicorn

from .config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "coach.main:app",
        host="127.0.0.1",
        port=settings.coach_port,
        reload=True,
    )


if __name__ == "__main__":
    main()
