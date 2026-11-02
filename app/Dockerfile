# ============================================================================
# Étape 1 : Build de l'application Go (Multi-stage build)
# ============================================================================
FROM golang:1.22-alpine AS builder

WORKDIR /src

# Copier les fichiers sources et résoudre les dépendances Go
COPY . .
RUN go mod tidy

# Compiler un binaire statique sans dépendances C (CGO_ENABLED=0)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /out/webapp .

# ============================================================================
# Étape 2 : Image finale minimaliste et sécurisée (Normes DevSecOps)
# ============================================================================
FROM alpine:3.20

# Installer les certificats CA pour les appels HTTPS et créer un utilisateur non-root
RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /out/webapp /app/webapp

# Sécurité : Ne jamais exécuter un conteneur en root dans Kubernetes
USER appuser

EXPOSE 8080

ENTRYPOINT ["/app/webapp"]
