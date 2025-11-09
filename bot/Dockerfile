# --- ЭТАП 1: Сборщик зависимостей ---
# Используем полную версию Node.js для надежной компиляции пакетов
FROM node:20 as builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json для установки зависимостей
COPY package.json ./

# Устанавливаем все зависимости
RUN npm install

# --- ЭТАП 2: Финальный образ ---
# Используем легковесный образ Node.js
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем ВЕСЬ код нашего приложения
COPY . .

# Копируем уже готовую папку node_modules из этапа "builder"
COPY --from=builder /app/node_modules ./node_modules

# Команда для запуска бота
CMD ["node", "bot.js"]