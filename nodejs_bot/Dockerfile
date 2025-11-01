# Используем легковесный образ Node.js
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости, используя 'npm ci' для чистоты сборки
RUN npm ci --only=production

# Копируем исходный код бота
COPY . .

# Команда для запуска бота
CMD ["node", "bot.js"]