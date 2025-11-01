# Используем официальный образ Playwright, в котором уже есть все зависимости
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файл с зависимостями и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь остальной код приложения
COPY . .

# Открываем порт, на котором будет работать API
EXPOSE 18361

# Команда для запуска приложения
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "18361"]