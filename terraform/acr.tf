# Génère un suffixe aléatoire car le nom d'un ACR doit être unique dans tout Azure
resource "random_string" "acr_suffix" {
  length  = 5
  special = false
  upper   = false
}

resource "azurerm_container_registry" "acr" {
  name                = "acr${var.project_name}${random_string.acr_suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = false # Norme de sécurité : utiliser les identités managées, jamais de compte admin partagé
  tags                = var.tags
}

# Autorise AKS (Kubelet) à tirer les images Docker depuis l'ACR sans secret statique
resource "azurerm_role_assignment" "aks_acr_pull" {
  principal_id                     = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.acr.id
  skip_service_principal_aad_check = true
}
