# Используем официальный образ Playwright, в котором уже есть все зависимости
FROM python:3.11-slim

LABEL maintainer="Evil0ctal"

# Устанавливаем ffmpeg для анализа видео
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y ffmpeg

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем приложение
COPY . /app

# Используем Aliyun镜像源加速 pip (оставим, может пригодиться)
RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ -U pip \
    && pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Убедимся, что скрипт запуска исполняемый
RUN chmod +x start.sh

# Команда для запуска
CMD ["./start.sh"]
