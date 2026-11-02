<#
.SYNOPSIS
    Script d'automatisation DevOps pour vérifier les prérequis, tester en local ou déployer sur AKS.
#>

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("check", "local-docker", "local-k8s", "azure-deploy")]
    [string]$Action = "check"
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

if ($Action -eq "check") {
    Write-Step "Vérification des outils DevOps installés"
    $tools = @("docker", "kubectl", "git", "terraform", "az")
    foreach ($tool in $tools) {
        if (Get-Command $tool -ErrorAction SilentlyContinue) {
            Write-Host "[OK] $tool est installé" -ForegroundColor Green
        } else {
            Write-Host "[MANQUANT] $tool n'est pas installé" -ForegroundColor Yellow
        }
    }
    Write-Host "`nAstuce : Pour installer Terraform et Azure CLI sur Windows, exécutez :"
    Write-Host "  winget install Hashicorp.Terraform" -ForegroundColor Gray
    Write-Host "  winget install Microsoft.AzureCLI" -ForegroundColor Gray
}

elseif ($Action -eq "local-docker") {
    Write-Step "Démarrage de l'application Go + PostgreSQL avec Docker Compose"
    docker compose up --build -d
    Write-Host "Application disponible sur : http://localhost:8080" -ForegroundColor Green
    Write-Host "Healthcheck disponible sur : http://localhost:8080/healthz" -ForegroundColor Green
}

elseif ($Action -eq "local-k8s") {
    Write-Step "Build de l'image Docker et déploiement sur le cluster Kubernetes local (Docker Desktop)"
    docker build -t webapp:latest ./app
    kubectl apply -k ./k8s/base
    kubectl get pods -n devops-lab
    Write-Host "`nPour accéder à l'application en local via kubectl :" -ForegroundColor Green
    Write-Host "  kubectl port-forward svc/webapp-service -n devops-lab 8080:80" -ForegroundColor Yellow
}

elseif ($Action -eq "azure-deploy") {
    Write-Step "Déploiement de l'infrastructure Azure AKS avec Terraform"
    Push-Location ./terraform
    try {
        terraform init
        terraform plan -out=tfplan
        Write-Host "Exécutez 'terraform apply tfplan' dans le dossier ./terraform pour lancer la création sur Azure." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}
