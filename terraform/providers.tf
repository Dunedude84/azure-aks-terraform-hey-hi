terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # En production chez Devolutions, on décommente ce bloc pour stocker le state dans Azure Blob Storage :
  # backend "azurerm" {
  #   resource_group_name  = "rg-terraform-state"
  #   storage_account_name = "sttfstatedevolutions"
  #   container_name       = "tfstate"
  #   key                  = "aks-devops-lab.tfstate"
  # }
}

provider "azurerm" {
  subscription_id                 = "33993ce8-51c7-4312-a19f-5b7063d40d61"
  resource_provider_registrations = "none"

  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}
