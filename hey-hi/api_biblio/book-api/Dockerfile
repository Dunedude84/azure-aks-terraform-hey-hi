FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js app.js ./
COPY public ./public
COPY uploads ./uploads

# S'assurer que l'utilisateur non-root 'node' peut écrire dans /app/uploads
RUN chown -R node:node /app/uploads

USER node

EXPOSE 3001

CMD ["node", "index.js"]
