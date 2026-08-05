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
