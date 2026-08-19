FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero (mejor cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copia el resto del código
COPY . .

# Puerto del orquestador (Easypanel debe apuntar aquí)
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
