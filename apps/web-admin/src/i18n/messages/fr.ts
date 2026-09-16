import { webAdminRoutes } from "@/config/routes";

import { tenantMessagesFr } from "./tenant/fr";
import { enMessages } from "./en";
import type { WebAdminMessages } from "../messages-types";

/**
 * French tenant-admin bundle.
 *
 * The SaaS operator workspace intentionally keeps its English feature catalog
 * until that separate product surface receives a complete French translation.
 */
export const frMessages: WebAdminMessages = {
  ...enMessages,
  shell: {
    ...enMessages.shell,
    tenant: {
      eyebrow: "Administration du locataire",
      title: "Opérations des magasins",
      description:
        "Gérez les succursales, le personnel, les services, les rapports et les paramètres du locataire.",
      header: {
        searchLabel: "Rechercher dans l’espace du locataire",
        searchPlaceholder:
          "Rechercher des succursales, des utilisateurs ou des services...",
        assistantLabel: "Assistant CleanHub",
        messagesLabel: "Messages",
        accountLabel: "Utilisateur connecté",
        assistant: {
          title: "Assistant CleanHub",
          description:
            "Accédez aux pages et actions courantes de l’espace du locataire. Cet assistant facilite la navigation dans CleanHub ; il ne génère pas de réponses par IA.",
          closeLabel: "Fermer l’assistant",
          searchLabel: "Rechercher des actions",
          searchPlaceholder:
            "Rechercher des commandes, des produits ou des paramètres...",
          recommendedTitle: "Utile sur cette page",
          quickActionsTitle: "Tous les raccourcis",
          emptyTitle: "Aucune action correspondante",
          emptyDescription:
            "Essayez le nom d’une page ou d’une action, par exemple commandes ou rapports.",
          actions: {
            orders: {
              label: "Commandes",
              description:
                "Consultez les commandes des succursales auxquelles vous avez accès.",
            },
            customers: {
              label: "Clients",
              description: "Ouvrez le répertoire des clients du locataire.",
            },
            products: {
              label: "Produits",
              description: "Consultez les produits, les prix et les stocks.",
            },
            newProduct: {
              label: "Ajouter un produit",
              description: "Créez un nouveau produit physique.",
            },
            services: {
              label: "Services",
              description: "Consultez le catalogue des services.",
            },
            newService: {
              label: "Ajouter un service",
              description: "Créez un service à vendre.",
            },
            discounts: {
              label: "Remises",
              description: "Consultez les remises actives et planifiées.",
            },
            newDiscount: {
              label: "Créer une remise",
              description: "Configurez une nouvelle règle de remise.",
            },
            reports: {
              label: "Rapports",
              description:
                "Consultez les performances et les tendances de l’activité.",
            },
            finance: {
              label: "Finance",
              description:
                "Ouvrez les synthèses des ventes, versements et finances.",
            },
            settings: {
              label: "Paramètres du locataire",
              description:
                "Gérez la configuration du locataire et des succursales.",
            },
          },
        },
        messages: {
          title: "Messages",
          unreadCount: "{count} non lu(s)",
          noUnread: "Vous êtes à jour",
          markAllRead: "Tout marquer comme lu",
          marking: "Mise à jour...",
          loading: "Chargement des messages...",
          errorTitle: "Impossible de charger les messages",
          errorHint: "Vérifiez la connexion et réessayez.",
          retry: "Réessayer",
          emptyTitle: "Aucun message pour le moment",
          emptyHint: "Les nouvelles notifications apparaîtront ici.",
          businessType: "Activité",
          systemType: "Système",
          unreadStatus: "Non lu",
          readStatus: "Lu",
          markRead: "Marquer comme lu",
          relatedOrder: "Ouvrir les commandes",
          viewAll: "Afficher toutes les notifications",
        },
        account: {
          menuLabel: "Ouvrir le menu du compte",
          roleLabel: "Rôle",
          branchScopeLabel: "Accès aux succursales",
          allBranches: "Toutes les succursales",
          assignedBranches: "{count} succursale(s) attribuée(s)",
          profile: "Espace personnel",
          loadingProfile: "Chargement de l’espace personnel…",
          employees: "Gestion des employés",
          settings: "Paramètres du locataire",
        },
      },
    },
  },
  sidebar: {
    ...enMessages.sidebar,
    tenant: [
      {
        title: "Principal",
        items: [
          { label: "Accueil", href: webAdminRoutes.tenant.home },
          { label: "Commandes", href: webAdminRoutes.tenant.orders },
          { label: "Clients", href: webAdminRoutes.tenant.customers },
          { label: "Personnel", href: webAdminRoutes.tenant.users },
          { label: "Produits", href: webAdminRoutes.tenant.products },
          { label: "Remises", href: webAdminRoutes.tenant.discounts },
          {
            label: "Point de vente",
            href: webAdminRoutes.tenant.pointOfSale.home,
          },
          { label: "Rapports", href: webAdminRoutes.tenant.reports },
          { label: "Finance", href: webAdminRoutes.tenant.finance },
        ],
      },
      {
        title: "Magasins et appareils",
        items: [
          {
            label: "Succursales",
            href: webAdminRoutes.tenant.config.branches,
          },
          {
            label: "Notifications",
            href: webAdminRoutes.tenant.notifications,
          },
        ],
      },
      {
        title: "Paramètres système",
        items: [
          {
            label: "Journaux d’activité",
            href: webAdminRoutes.tenant.system.logs,
          },
          {
            label: "Sauvegardes",
            href: webAdminRoutes.tenant.system.backups,
          },
          {
            label: "Paramètres du locataire",
            href: webAdminRoutes.tenant.system.settings,
          },
        ],
      },
    ],
  },
  common: {
    personalCenter: "Espace personnel",
    language: "Langue",
    languageLabels: {
      en: "Anglais",
      fr: "Français",
      zhCN: "Chinois simplifié",
    },
    theme: "Thème",
    switchToDarkTheme: "Passer au thème sombre",
    switchToLightTheme: "Passer au thème clair",
    signOut: "Se déconnecter",
    signingOut: "Déconnexion...",
    auditCategories: {
      auth: "Connexion et authentification",
      saas_platform: "Plateforme SaaS",
      saas_tenant: "Locataires SaaS",
      saas_user: "Utilisateurs SaaS",
      tenant_branch: "Succursales",
      tenant_user: "Comptes du personnel",
      tenant_service: "Services",
      tenant_price: "Tarifs",
      tenant_hardware: "Configuration des périphériques",
      tenant_notification: "Paramètres de notification",
      tenant_settings: "Paramètres du locataire",
      tenant_product: "Produits",
      tenant_customer: "Fiches clients",
      tenant_order: "Commentaires de commande",
      tenant_backup: "Sauvegardes",
      pos_order: "Commandes POS",
      pos_service_ticket: "Bons de service",
      pos_customer: "Comptes clients",
      pos_hardware: "Matériel POS",
      pos_terminal_security: "Sécurité des terminaux",
      pos_shift: "Services du personnel",
      pos_register: "Caisse",
      pos_notification: "Notifications POS",
      pos_channel_settings: "Paramètres du canal POS",
    },
    auditEvents: {
      "auth.login.success": "Connexion réussie",
      "auth.login.failed": "Échec de la connexion",
      "auth.logout": "Déconnexion",
      "auth.refresh.reuse_detected": "Réutilisation d'un jeton détectée",
      "auth.pos_pin_login.success": "Connexion caissier par PIN réussie",
      "auth.pos_pin_login.failed": "Échec de la connexion caissier par PIN",
      "platform_settings.updated": "Paramètres de la plateforme mis à jour",
      "security_settings.updated": "Paramètres de sécurité mis à jour",
      "security.settings.updated": "Paramètres de sécurité mis à jour",
      "backup_job.created": "Tâche de sauvegarde créée",
      "restore_request.created": "Demande de restauration créée",
      "feedback_ticket.status_updated": "Statut du ticket mis à jour",
      "feedback_ticket.assignee_updated": "Responsable du ticket mis à jour",
      "tenant.created": "Locataire créé",
      "tenant.updated": "Locataire mis à jour",
      "tenant.status_updated": "Statut du locataire mis à jour",
      "tenant_settings.updated": "Paramètres du locataire mis à jour",
      "tenant_feature_flags.updated": "Options du locataire mises à jour",
      "saas_user.created": "Utilisateur plateforme créé",
      "saas_user.updated": "Utilisateur plateforme mis à jour",
      "saas_user.roles_updated": "Rôles de l'utilisateur mis à jour",
      "saas_user.status_updated": "Statut de l'utilisateur mis à jour",
      "branch.created": "Succursale créée",
      "branch.updated": "Succursale mise à jour",
      "branch.status_changed": "Statut de la succursale modifié",
      "tenant_user.created": "Employé créé",
      "tenant_user.updated": "Employé mis à jour",
      "tenant_user.disabled": "Employé désactivé",
      "tenant_user.pin_reset": "PIN de l'employé réinitialisé",
      "tenant_user.owner_created": "Compte propriétaire créé",
      "service.created": "Service créé",
      "service.updated": "Service mis à jour",
      "service.status_changed": "Statut du service modifié",
      "service.deleted": "Service supprimé",
      "price.created": "Tarif créé",
      "price.updated": "Tarif mis à jour",
      "price.deleted": "Tarif supprimé",
      "tenant_hardware.created": "Périphérique créé",
      "tenant_hardware.updated": "Périphérique mis à jour",
      "tenant_hardware.deleted": "Périphérique supprimé",
      "notification_settings.updated": "Paramètres de notification mis à jour",
      "settings.updated": "Paramètres mis à jour",
      "product.created": "Produit créé",
      "product.updated": "Produit mis à jour",
      "tenant.customer.comment_created": "Commentaire ajouté au client",
      "tenant.customer.comment_updated": "Commentaire client modifié",
      "tenant.order.comment_created": "Commentaire ajouté à la commande",
      "pos.order.created": "Commande créée",
      "pos.order.item_added": "Article ajouté à la commande",
      "pos.order.payment_created": "Paiement enregistré",
      "pos.order.payment_refunded": "Paiement remboursé",
      "pos.order.status_changed": "Statut de la commande modifié",
      "pos.service_ticket.created": "Bon de service créé",
      "pos.service_ticket.item_added": "Article ajouté au bon",
      "pos.service_ticket.item_updated": "Article du bon mis à jour",
      "pos.service_ticket.item_status_changed": "Statut de l'article modifié",
      "pos.service_ticket.status_changed": "Statut du bon modifié",
      "pos.service_ticket.status_synced_from_items":
        "Statut du bon aligné sur ses articles",
      "pos_customer.profile_created": "Fiche client créée",
      "pos_customer.account_created": "Compte client créé",
      "pos_customer.account_status_changed": "Statut du compte client modifié",
      "pos_customer.account_deleted": "Compte client supprimé",
      "pos_hardware.printer.bound": "Imprimante associée au terminal",
      "pos_hardware.print_job.printed": "Reçu imprimé",
      "pos_hardware.print_job.failed": "Échec de l'impression du reçu",
      "pos_hardware.built_in.connected": "Périphérique intégré connecté",
      "pos_hardware.cash_payment_drawer.failed":
        "Échec d'ouverture du tiroir-caisse",
      "pos_hardware.privileged_reprint.authorized":
        "Réimpression du reçu autorisée",
      "pos_terminal.enrolled": "Terminal enregistré",
      "pos_terminal.enabled": "Terminal activé",
      "pos_terminal.disabled": "Terminal désactivé",
      "pos_terminal.revoked": "Accès du terminal révoqué",
      "pos_terminal.credential_rotated": "Identifiants du terminal renouvelés",
      "pos_terminal.credential_re_enrolled": "Terminal réenregistré",
      "pos_terminal.rebound": "Terminal rattaché à une autre succursale",
      "pos.shift.clock_in": "Pointage d'arrivée",
      "pos.shift.break_start": "Début de pause",
      "pos.shift.break_end": "Fin de pause",
      "pos.shift.security_forced_closed":
        "Service clôturé d'office par une mesure de sécurité",
      "pos.register.opened": "Caisse ouverte",
      "pos.notification.read": "Notification lue",
      "pos_channel_settings.updated": "Paramètres du canal POS mis à jour",
    },
  },
  auth: {
    brandName: "Administration Web CleanHub",
    brandSuffix: "Console de gestion",
    heroTitle: "Vos opérations quotidiennes, clairement organisées.",
    heroDescription:
      "Gérez les magasins, le personnel, les services, les rapports et les paramètres opérationnels depuis un espace sécurisé.",
    title: "Bon retour parmi nous",
    description:
      "Connectez-vous avec votre adresse e-mail professionnelle. CleanHub vous dirigera vers l’espace correspondant à votre compte.",
    identifierLabel: "Adresse e-mail",
    identifierPlaceholder: "admin@cleanhub.local",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Saisissez votre mot de passe",
    passwordShow: "Afficher le mot de passe",
    passwordHide: "Masquer le mot de passe",
    submit: "Se connecter",
    submitting: "Connexion...",
    signedIn: "Connexion réussie.",
    validation: {
      identifierRequired: "L’adresse e-mail est requise.",
      identifierInvalid: "Saisissez une adresse e-mail valide.",
      passwordRequired: "Le mot de passe est requis.",
    },
    errors: {
      checkForm: "Vérifiez le formulaire de connexion.",
      accessDenied:
        "Ce compte ne peut pas accéder à l’administration Web CleanHub. Connectez-vous avec un compte propriétaire, responsable ou administrateur de la plateforme.",
      signInFailed:
        "Impossible de se connecter. Vérifiez vos informations et réessayez.",
    },
    redirect: {
      sessionExpired: "Votre session a expiré. Connectez-vous à nouveau.",
      tenantAccessDenied:
        "Ce compte ne peut pas accéder à l’administration du locataire. Connectez-vous avec un compte propriétaire ou responsable.",
    },
  },
  tenant: tenantMessagesFr,
};
