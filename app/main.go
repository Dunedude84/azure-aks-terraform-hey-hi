package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

type SecretEntry struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"created_at"`
}

type PageData struct {
	Hostname  string
	Env       string
	DBStatus  string
	Entries   []SecretEntry
}

var db *sql.DB

func main() {
	port := getEnv("PORT", "8080")
	env := getEnv("APP_ENV", "development")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/vaultdb?sslmode=disable")

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("WARN: erreur d'ouverture de connexion DB: %v", err)
	} else {
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(5 * time.Minute)
		initSchema()
	}

	mux := http.NewServeMux()

	// Endpoints Kubernetes Liveness & Readiness Probes
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			http.Error(w, "db non configuree", http.StatusServiceUnavailable)
			return
		}
		if err := db.Ping(); err != nil {
			http.Error(w, fmt.Sprintf("db non prete: %v", err), http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ready"))
	})

	// Endpoint d'observabilité (Datadog / Prometheus)
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		hostname, _ := os.Hostname()
		dbOK := db != nil && db.Ping() == nil
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"service":   "devops-vault-web",
			"hostname":  hostname,
			"env":       env,
			"db_online": dbOK,
			"timestamp": time.Now().UTC(),
		})
	})

	// Ajouter une entrée dans PostgreSQL
	mux.HandleFunc("/add", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		name := r.FormValue("name")
		category := r.FormValue("category")
		if name != "" && db != nil {
			_, err := db.Exec("INSERT INTO entries (name, category) VALUES ($1, $2)", name, category)
			if err != nil {
				log.Printf("ERROR insert: %v", err)
			}
		}
		http.Redirect(w, r, "/", http.StatusSeeOther)
	})

	// Page principale
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		hostname, _ := os.Hostname()
		dbStatus := "Connecté à PostgreSQL"
		var entries []SecretEntry

		if db == nil || db.Ping() != nil {
			dbStatus = "Déconnecté (Mode dégradé)"
		} else {
			initSchema()
			rows, err := db.Query("SELECT id, name, category, created_at FROM entries ORDER BY id DESC LIMIT 20")
			if err == nil {
				defer rows.Close()
				for rows.Next() {
					var e SecretEntry
					if err := rows.Scan(&e.ID, &e.Name, &e.Category, &e.CreatedAt); err == nil {
						entries = append(entries, e)
					}
				}
			}
		}

		tmpl := template.Must(template.New("index").Parse(htmlTemplate))
		tmpl.Execute(w, PageData{
			Hostname: hostname,
			Env:      env,
			DBStatus: dbStatus,
			Entries:  entries,
		})
	})

	log.Printf("INFO: Serveur démarré sur le port %s (env=%s)", port, env)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("FATAL: %v", err)
	}
}

func initSchema() {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS entries (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		log.Printf("WARN: initSchema en attente de PostgreSQL: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>DevOps Lab - AKS + Terraform + Cloudflare</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #334155; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; background: #0284c7; font-size: 0.85rem; }
    input, select, button { padding: 0.5rem; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: white; }
    button { background: #2563eb; border: none; cursor: pointer; font-weight: bold; padding: 0.5rem 1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; }
  </style>
</head>
<body>
  <h1>Lab DevOps : Azure AKS & Terraform</h1>
  <div class="card">
    <p><strong>Pod Kubernetes (Hostname) :</strong> <code>{{.Hostname}}</code></p>
    <p><strong>Environnement :</strong> <span class="badge">{{.Env}}</span></p>
    <p><strong>Statut Base de données :</strong> {{.DBStatus}}</p>
  </div>

  <div class="card">
    <h2>Ajouter un serveur / service à l'inventaire</h2>
    <form method="POST" action="/add">
      <input type="text" name="name" placeholder="Ex: srv-prod-aks-01" required />
      <select name="category">
        <option value="Kubernetes">Kubernetes</option>
        <option value="Database">Database</option>
        <option value="Cloudflare Tunnel">Cloudflare Tunnel</option>
        <option value="SSH / Bastion">SSH / Bastion</option>
      </select>
      <button type="submit">Enregistrer dans PostgreSQL</button>
    </form>

    <table>
      <thead>
        <tr><th>ID</th><th>Nom de la ressource</th><th>Catégorie</th><th>Date de création</th></tr>
      </thead>
      <tbody>
        {{range .Entries}}
        <tr>
          <td>#{{.ID}}</td>
          <td>{{.Name}}</td>
          <td>{{.Category}}</td>
          <td>{{.CreatedAt.Format "2006-01-02 15:04:05"}}</td>
        </tr>
        {{else}}
        <tr><td colspan="4">Aucune entrée pour le moment. Ajoutez-en une ci-dessus !</td></tr>
        {{end}}
      </tbody>
    </table>
  </div>
</body>
</html>`
