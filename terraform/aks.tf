data "azurerm_client_config" "current" {}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-${var.project_name}-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "${var.project_name}-${var.environment}"
  kubernetes_version  = var.kubernetes_version

  # Tier Free pour économiser pendant l'apprentissage ("Standard" en production)
  sku_tier = "Free"

  # Sécurité & Conformité : OIDC + Workload Identity (authentification sans mot de passe)
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  default_node_pool {
    name                        = "systempool"
    vm_size                     = var.system_node_vm_size
    vnet_subnet_id              = azurerm_subnet.aks_nodes.id
    auto_scaling_enabled        = true
    min_count                   = var.min_node_count
    max_count                   = var.max_node_count
    os_disk_size_gb             = 30
    temporary_name_for_rotation = "temppool"

    upgrade_settings {
      max_surge = "10%"
    }
  }

  # Important : Évite que Terraform écrase le nombre de noeuds géré par l'autoscaler
  lifecycle {
    ignore_changes = [default_node_pool[0].node_count]
  }

  # Identité managée par Azure
  identity {
    type = "SystemAssigned"
  }

  # Réseau moderne : Azure CNI Overlay + Politiques réseau Cilium (eBPF)
  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_policy      = "cilium"
    network_data_plane  = "cilium"
    pod_cidr            = "192.168.0.0/16"
    service_cidr        = "10.20.0.0/16"
    dns_service_ip      = "10.20.0.10"
  }

  # Gestion des accès via Microsoft Entra ID (Azure AD RBAC)
  azure_active_directory_role_based_access_control {
    azure_rbac_enabled = true
    tenant_id          = data.azurerm_client_config.current.tenant_id
  }

  tags = var.tags
}
