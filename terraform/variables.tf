variable "project_name" {
  description = "Nom du projet utilisé pour le nommage des ressources Azure"
  type        = string
  default     = "devolutionslab"
}

variable "environment" {
  description = "Environnement (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Région Azure (canadacentral = Toronto, canadaeast = Québec)"
  type        = string
  default     = "canadacentral"
}

variable "kubernetes_version" {
  description = "Version de Kubernetes pour AKS"
  type        = string
  default     = "1.35"
}

variable "system_node_vm_size" {
  description = "Taille des VMs pour le pool système"
  type        = string
  default     = "Standard_D2as_v7"
}

variable "min_node_count" {
  description = "Nombre minimum de noeuds pour l'autoscaler"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Nombre maximum de noeuds pour l'autoscaler"
  type        = number
  default     = 3
}

variable "tags" {
  description = "Tags standards appliqués à toutes les ressources (FinOps & Gouvernance)"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
    Project   = "AKS-DevOps-Lab"
    Security  = "ZeroTrust-CloudflareTunnel"
  }
}
