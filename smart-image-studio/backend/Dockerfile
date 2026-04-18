FROM python:3.13-slim

ENV POETRY_VIRTUALENVS_IN_PROJECT=true

RUN pip install poetry

WORKDIR /app

COPY pyproject.toml poetry.lock poetry.toml ./
RUN poetry install --no-root

COPY . .

CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
