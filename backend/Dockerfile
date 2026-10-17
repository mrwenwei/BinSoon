FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=UTC
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m scripts.import_data && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
