version: '3.8'

services:
  api:
    build:
      context: ./python_api
      dockerfile: Dockerfile
    restart: always
    ports:
      - "18361:18361"
    env_file:
      - ./python_api/.env
    volumes:
      - api_video_cache:/app/video_cache
      - api_audio_cache:/app/audio_files
      - api_temp_images:/app/temp_images
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18361/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  bot:
    build:
      context: ./nodejs_bot
      dockerfile: Dockerfile
    restart: always
    depends_on:
      api:
        condition: service_healthy
    env_file:
      - ./nodejs_bot/.env

volumes:
  api_video_cache:
  api_audio_cache:
  api_temp_images: