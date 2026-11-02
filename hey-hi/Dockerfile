FROM node:22-alpine

WORKDIR /app

# Copier uniquement package.json et package-lock.json pour optimiser le cache Docker
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le code de l'application (horaire)
COPY server.js ./
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY public ./public

# Utiliser l'utilisateur non-root intégré à l'image officielle Node
USER node

EXPOSE 3000

CMD ["node", "server.js"]
