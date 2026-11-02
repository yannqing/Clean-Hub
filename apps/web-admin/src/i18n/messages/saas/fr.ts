import { countrySetupFr } from "./country-setup";
import type { SaasMessages } from "./types";

export const saasMessagesFr: SaasMessages = {
  common: {
    refresh: "Actualiser",
    clear: "Effacer",
    clearFilters: "Effacer les filtres",
    search: "Rechercher",
    status: "Statut",
    allStatuses: "Tous les statuts",
    allLevels: "Tous les niveaux",
    allCategories: "Toutes les catégories",
    allResults: "Tous les résultats",
    allScopes: "Tous les périmètres",
    allPriorities: "Toutes les priorités",
    tryAgain: "Réessayer",
    cancel: "Annuler",
    close: "Fermer",
    saving: "Enregistrement...",
    creating: "Création...",
    submitting: "Envoi...",
    updating: "Mise à jour...",
    saveChanges: "Enregistrer les modifications",
    actions: "Actions",
    created: "Création",
    from: "Du",
    to: "Au",
    platform: "Plateforme",
    system: "Système",
    unknown: "Inconnu",
    never: "Jamais",
    notSet: "Non renseigné",
    invalidDate: "Date invalide",
    previousPage: "Page précédente",
    nextPage: "Page suivante",
    optionalUlid: "ULID facultatif",
    optionalTenantUlid: "ULID du locataire facultatif",
    modulePlaceholder: "Module à venir",
    badge: "Administration Web CleanHub",
    somethingWentWrong: "Une erreur est survenue",
    loadErrorDescription:
      "Impossible de charger cette page. Veuillez réessayer.",
    notFoundTitle: "Page introuvable",
    notFoundDescription: "La page recherchée n’existe pas ou a été déplacée.",
    statusLabels: {
      active: "Actif",
      suspended: "Suspendu",
      disabled: "Désactivé",
      invited: "Invité",
      open: "Ouvert",
      inProgress: "En cours",
      resolved: "Résolu",
      closed: "Fermé",
    },
    priorityLabels: {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
      urgent: "Urgent",
    },
    levelLabels: {
      debug: "Débogage",
      info: "Information",
      warn: "Avertissement",
      error: "Erreur",
    },
    severityLabels: {
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
      critical: "Critique",
    },
    backupScopeLabels: {
      platform: "Plateforme",
      tenant: "Locataire",
    },
    backupStatusLabels: {
      pending: "En attente",
      running: "En cours d’exécution",
      succeeded: "Réussi",
      failed: "Échec",
    },
    restoreStatusLabels: {
      pending: "En attente",
      approved: "Approuvé",
      rejected: "Rejeté",
      completed: "Terminé",
      cancelled: "Annulé",
    },
    roleLabels: {
      support: "Assistance",
      superAdmin: "Super administrateur",
      unassigned: "Non attribué",
    },
    languageLabels: {
      en: "Anglais",
      fr: "Français",
      zhCN: "Chinois",
      platformDefault: "Utiliser la valeur par défaut de la plateforme",
    },
    resultLabels: {
      success: "Réussite",
      failed: "Échec",
    },
  },
  overview: {
    badge: "Plateforme SaaS",
    title: "Vue d’ensemble de la plateforme",
    welcomeTitle:
      "Bienvenue sur CleanHub. Que souhaitez-vous traiter en premier ?",
    searchLabel:
      "Rechercher des locataires ou des utilisateurs de la plateforme",
    searchPlaceholder:
      "Rechercher par nom de locataire, code ou utilisateur de la plateforme...",
    quickActionsLabel: "Ouvrir les actions rapides",
    sendLabel: "Rechercher",
    searchNoResults:
      "Aucun locataire ni utilisateur de la plateforme ne correspond.",
    searchLoading: "Recherche...",
    loadError: "Impossible de charger la vue d’ensemble de la plateforme.",
    quickEntries: {
      tenants: {
        title: "Gestion des locataires",
        description:
          "Consultez les fiches, les statuts et les paramètres des locataires.",
      },
      users: {
        title: "Gestion des utilisateurs",
        description:
          "Consultez les membres de la plateforme et les administrateurs des locataires.",
      },
      feedback: {
        title: "Tickets de retour",
        description: "Traitez les retours clients et les suivis en attente.",
      },
      security: {
        title: "Centre de sécurité",
        description:
          "Consultez les politiques, les règles de connexion et les événements à risque.",
      },
    },
    metrics: {
      tenants: "Locataires",
      activeTenants: "Locataires actifs",
      suspendedTenants: "Locataires suspendus",
      branches: "Succursales",
      todayOrders: "Commandes du jour",
      todayRevenue: "Chiffre d’affaires du jour",
      pendingFeedback: "Retours en attente",
    },
  },
  tenants: {
    identity: {
      systemId: "Identifiant système",
      systemIdHint:
        "Identifiant unique généré automatiquement, utilisé pour les liens internes et l’assistance technique. Vous n’avez pas besoin de le mémoriser. Utilisez le code du locataire pour vos échanges commerciaux.",
      tenantCodeHint:
        "Le code du locataire identifie cette entreprise dans les recherches et les échanges. Le modifier ne change pas l’identifiant système.",
    },
    list: {
      badge: "Locataires SaaS",
      title: "Gestion des locataires",
      newTenant: "Nouveau locataire",
      searchPlaceholder: "Nom, code, pays, ville",
      metrics: {
        total: "Total",
        active: "Actif",
        suspended: "Suspendu",
        disabled: "Désactivé",
      },
      emptyFiltered:
        "Aucun locataire ne correspond à la recherche ou au statut sélectionné.",
      emptyDefault: "Aucun locataire n’a encore été créé.",
      emptyTitle: "Aucun locataire trouvé",
      loadError: "Impossible de charger les locataires.",
      columns: {
        name: "Nom du commerçant",
        pressingCode: "Code du locataire",
        status: "Statut",
        country: "Pays",
        city: "Ville",
        createdAt: "Date de création",
      },
      detail: "Détail",
      settings: "Paramètres",
    },
    detail: {
      badge: "Fiche du locataire",
      title: "Détails du locataire",
      settings: "Paramètres",
      backToTenants: "Retour aux locataires",
      loadError: "Impossible de charger le locataire.",
      sessionError: "Impossible de vérifier la session actuelle.",
      notFoundTitle: "Locataire introuvable",
      notFoundDescription: "Impossible de charger le locataire demandé.",
      statusSection: "Statut du locataire",
      statusReasonHint:
        "Toute modification de statut exige un motif pour le journal d’audit.",
      statusPermissionHint:
        "Seul un super administrateur peut modifier le statut d’un locataire.",
      reason: "Motif",
      reasonPlaceholder: "Obligatoire pour le journal d’audit",
      activate: "Activer",
      suspend: "Suspendre",
      disable: "Désactiver",
      statusUpdated: "Statut du locataire mis à jour : {status}.",
      statusUpdateFailed: "Échec de la mise à jour du statut du locataire.",
      statusPermissionError:
        "Seuls les super administrateurs peuvent modifier le statut des locataires.",
      readOnlyHint:
        "Vous pouvez consulter les détails du locataire. La modification de sa fiche exige le rôle de super administrateur ou le droit d’écriture SaaS sur les locataires.",
      offboardSection: "Clôture du locataire",
      offboardHint:
        "La clôture désactive immédiatement les accès et conserve les données pendant un délai de rétention. Un export est effectué automatiquement avant la désactivation des accès.",
      offboardPermissionHint:
        "Seul un super administrateur peut clôturer un locataire.",
      offboardAction: "Clôturer le locataire",
      offboardConfirm:
        "Clôturer ce locataire ? Les accès seront immédiatement désactivés. Les données seront conservées jusqu’à la fin du délai de rétention et la clôture pourra être annulée jusque-là.",
      offboardSucceeded:
        "Locataire clôturé. {tables} table(s) ont été exportées au préalable.",
      offboardFailed: "Échec de la clôture du locataire.",
      offboardedBanner:
        "Ce locataire a été clôturé le {date}. Motif : {reason}",
      purgeAfterLabel: "Données conservées jusqu’au {date}",
      restoreAction: "Annuler la clôture",
      restoreSucceeded: "Clôture annulée. Le locataire est désormais suspendu.",
      restoreFailed: "Impossible d’annuler la clôture.",
      exportAction: "Exporter les données",
      exportHint:
        "Téléchargez tous les enregistrements métier de ce locataire dans une archive ZIP de fichiers CSV.",
      exportSucceeded: "Export téléchargé.",
      exportFailed: "Échec de l’export des données du locataire.",
      tenantUsersTitle: "Utilisateurs du locataire",
      tenantUsersHint:
        "Le propriétaire initial appartient à ce locataire et figure également dans la gestion des utilisateurs.",
      tenantUsersEmpty: "Aucun utilisateur n’a été créé pour ce locataire.",
      tenantUsersLoading: "Chargement des utilisateurs du locataire...",
      tenantUsersLoadError:
        "Impossible de charger les utilisateurs du locataire.",
      fields: {
        pressingCode: "Code du locataire",
        status: "Statut",
        defaultLanguage: "Langue par défaut",
        users: "Utilisateurs",
        country: "Pays",
        city: "Ville",
        defaultCurrency: "Devise par défaut",
        contactName: "Nom du contact",
        contactPhone: "Téléphone du contact",
        contactEmail: "E-mail du contact",
        createdAt: "Date de création",
        updatedAt: "Date de mise à jour",
      },
    },
    new: {
      badge: "Création d’un locataire",
      title: "Nouveau locataire",
      backToTenants: "Retour aux locataires",
      sessionError: "Impossible de vérifier la session actuelle.",
      permissionHint: "Seul un super administrateur peut créer des locataires.",
    },
    settings: {
      badge: "Paramètres du locataire",
      title: "Paramètres du locataire",
      backToDetail: "Retour à la fiche",
      refresh: "Actualiser",
      loadError: "Impossible de charger les paramètres du locataire.",
      sessionError: "Impossible de vérifier la session actuelle.",
      notFoundTitle: "Paramètres du locataire introuvables",
      notFoundDescription:
        "Impossible de charger les paramètres du locataire demandé.",
      defaultsSection: "Valeurs par défaut du locataire",
      currencyHint:
        "La devise dépend du modèle fiscal du pays. Modifiez le pays sur cette page pour l’actualiser. Les données métier existantes nécessitent une migration de devise.",
      featureFlagsSection: "Fonctionnalités",
      featureFlagOptions: {
        laundryEnabled: {
          label: "Blanchisserie et nettoyage à sec",
          description:
            "Parcours de blanchisserie, de pressing et de nettoyage à sec.",
        },
        carWashEnabled: {
          label: "Lavage automobile",
          description: "Services, tarifs et opérations de lavage automobile.",
        },
        retailProductsEnabled: {
          label: "Produits de détail",
          description:
            "Lessive, produits d’entretien, consommables et ventes au détail.",
        },
        deliveryEnabled: {
          label: "Collecte et livraison",
          description:
            "Collecte à domicile, statuts de livraison et parcours du personnel de livraison.",
        },
        notificationsEnabled: {
          label: "Notifications",
          description:
            "Paramètres WhatsApp, SMS, e-mail et historique des envois.",
        },
        emailEnabled: {
          label: "Envoi d’e-mails",
          description:
            "Reçus et notifications par e-mail. Nécessite le SMTP de la plateforme ; sans celui-ci, l’option reste masquée en caisse même si elle est activée ici.",
        },
        customerOtpEnabled: {
          label: "Connexion client par code à usage unique",
          description:
            "Autorise la connexion des clients par code à usage unique. Laissez cette option désactivée tant qu’aucun fournisseur SMS ou e-mail n’est configuré.",
        },
      },
      pilotSection: "Statut du pilote",
      saveDefaults: "Enregistrer les valeurs par défaut",
      saveFeatureFlags: "Enregistrer les fonctionnalités",
      defaultsSaved: "Paramètres du locataire mis à jour.",
      defaultsSaveFailed:
        "Échec de la mise à jour des paramètres du locataire.",
      flagsSaved: "Fonctionnalités du locataire mises à jour.",
      flagsLoading: "Chargement des fonctionnalités du locataire…",
      flagsLoadFailed:
        "Impossible de charger les fonctionnalités de ce locataire. Actualisez pour réessayer.",
      flagsSaveFailed:
        "Échec de la mise à jour des fonctionnalités du locataire.",
      pilotStatus: "Statut du pilote",
      enabledFeatures: "Fonctionnalités activées",
      readOnlyHint:
        "Vous pouvez consulter les paramètres du locataire. La modification des valeurs par défaut et des fonctionnalités exige le rôle de super administrateur ou le droit d’écriture SaaS sur les locataires.",
      statusPermissionHint:
        "Seul un super administrateur peut modifier le statut d’un locataire.",
      tenantUpdated: "Locataire mis à jour",
      settingsUpdated: "Paramètres mis à jour",
      flagsUpdated: "Fonctionnalités mises à jour",
    },
    form: {
      countrySetup: countrySetupFr,
      profileSection: "Fiche du locataire",
      defaultsSection: "Valeurs par défaut",
      ownerSection: "Propriétaire initial",
      contactSection: "Coordonnées",
      createdToast: "Locataire créé.",
      updatedToast: "Locataire mis à jour.",
      createTenant: "Créer le locataire",
      autoGeneratedCode:
        "Généré automatiquement lors de la création du locataire",
      initialCredentialHint:
        "Ces identifiants servent à la première connexion. Le propriétaire peut modifier son mot de passe et son PIN dans les paramètres de son compte.",
      fields: {
        name: "Nom du commerçant",
        pressingCode: "Code du locataire",
        country: "Pays",
        city: "Ville",
        defaultLanguage: "Langue par défaut",
        defaultCurrency: "Devise par défaut",
        ownerName: "Nom du propriétaire",
        ownerEmail: "E-mail du propriétaire",
        ownerPhone: "Téléphone du propriétaire",
        ownerPin: "PIN du propriétaire",
        ownerPassword: "Mot de passe du propriétaire",
        contactName: "Nom du contact",
        contactPhone: "Téléphone du contact",
        contactEmail: "E-mail du contact",
      },
      featureFlags: {
        laundry: {
          label: "Blanchisserie et nettoyage à sec",
          description:
            "Parcours de blanchisserie, de pressing et de nettoyage à sec.",
        },
        carWash: {
          label: "Lavage automobile",
          description: "Services, tarifs et opérations de lavage automobile.",
        },
        retail: {
          label: "Produits de détail",
          description:
            "Lessive, produits d’entretien, consommables et ventes au détail.",
        },
        delivery: {
          label: "Collecte et livraison",
          description:
            "Collecte à domicile, statuts de livraison et parcours du personnel de livraison.",
        },
        notifications: {
          label: "Notifications",
          description:
            "Paramètres WhatsApp, SMS, e-mail et historique des envois.",
        },
      },
    },
  },
  users: {
    badge: "Plateforme SaaS",
    title: "Gestion des utilisateurs",
    accountTypeLabel: "Type de compte",
    allAccounts: "Tous les types de compte",
    platformAccount: "Membre de la plateforme",
    tenantAccount: "Administrateur de locataire",
    directoryHint:
      "Consultez ensemble les membres de la plateforme, les propriétaires et les responsables des locataires. Cliquez sur un membre pour ouvrir sa fiche utilisateur, ou sur le nom du locataire pour ouvrir sa fiche.",
    tenantColumn: "Locataire",
    ownerRole: "Propriétaire",
    managerRole: "Responsable",
    inviteMember: "Inviter un membre de la plateforme",
    readOnlyHint:
      "Les utilisateurs d’assistance peuvent consulter les utilisateurs et les rôles. La modification des membres, des rôles et la désactivation exigent le rôle de super administrateur.",
    sessionReadOnlyHint:
      "La gestion des membres est en lecture seule car la session actuelle n’a pas pu être vérifiée : {error}",
    roleRefreshError: "Impossible d’actualiser les rôles disponibles : {error}",
    loadError: "Impossible de charger les utilisateurs.",
    emptyTitle: "Aucun utilisateur trouvé",
    searchPlaceholder: "Nom, e-mail, téléphone, nom ou code du locataire",
    metrics: {
      total: "Total",
      active: "Actif",
      invited: "Invité",
      disabled: "Désactivé",
      suspended: "Suspendu",
    },
    columns: {
      member: "Membre",
      roles: "Rôles",
      language: "Langue",
      lastLogin: "Dernière connexion",
      created: "Création",
    },
    actions: {
      edit: "Modifier",
      roles: "Rôles",
      enable: "Activer",
      disable: "Désactiver",
      resetPassword: "Réinitialiser le mot de passe",
      resetPin: "Réinitialiser le PIN",
      view: "Voir l’utilisateur",
    },
    invite: {
      title: "Inviter un membre de la plateforme",
      description:
        "Invitez un membre SaaS de la plateforme et attribuez-lui un rôle initial sur la plateforme.",
      displayName: "Nom affiché",
      email: "E-mail",
      phone: "Téléphone",
      temporaryPassword: "Mot de passe temporaire",
      role: "Rôle",
      language: "Langue",
      sending: "Envoi de l’invitation",
      submit: "Inviter le membre",
      success: "Invitation créée avec succès.",
      failed: "Impossible d’envoyer l’invitation.",
    },
    edit: {
      title: "Modifier le membre de la plateforme",
      description:
        "Modifiez les informations du membre SaaS. Les rôles se gèrent séparément dans les paramètres des rôles de la plateforme.",
      timezone: "Fuseau horaire",
      success: "Membre de la plateforme mis à jour avec succès.",
      failed: "Échec de la mise à jour.",
    },
    detail: {
      title: "Détails de l’utilisateur",
      account: "Compte",
      activity: "Activité",
      userId: "Identifiant système de l’utilisateur",
      userIdHint:
        "Identifiant utilisateur unique généré automatiquement, utilisé pour les liens internes et l’assistance technique.",
      selfCredentialHint:
        "Pour modifier votre propre mot de passe, utilisez les paramètres de votre profil.",
      profileLink: "Ouvrir le profil",
      notProvided: "Non renseigné",
    },
    roles: {
      title: "Modifier les rôles de la plateforme",
      description: "Modifiez les rôles SaaS de ce membre sur la plateforme.",
      fallbackHint:
        "Échec de l’actualisation de la liste des rôles. Ce formulaire utilise les rôles SaaS intégrés autorisés.",
      success: "Rôles du membre de la plateforme mis à jour avec succès.",
      failed: "Échec de la mise à jour des rôles.",
      submit: "Enregistrer les rôles",
    },
    status: {
      disableTitle: "Désactiver le membre de la plateforme",
      enableTitle: "Activer le membre de la plateforme",
      disableConfirm:
        "Confirmez la désactivation de ce membre SaaS de la plateforme.",
      enableConfirm:
        "Confirmez l’activation de ce membre SaaS de la plateforme.",
      reason: "Motif",
      reasonRequired: "Le motif est obligatoire.",
      disableSuccess: "Membre de la plateforme désactivé avec succès.",
      enableSuccess: "Membre de la plateforme activé avec succès.",
      noAction: "Aucune action",
    },
    resetPin: {
      title: "Réinitialiser le PIN de l’utilisateur",
      description:
        "Réinitialisez le PIN à {value} et révoquez les sessions de renouvellement existantes. Cette opération ne modifie pas les rôles du compte et n’accorde pas d’accès au POS.",
      conflict:
        "Un autre utilisateur de ce locataire utilise déjà le PIN {value}. Modifiez son PIN avant de réinitialiser celui-ci.",
      reason: "Motif",
      reasonRequired: "Le motif est obligatoire.",
      submit: "Réinitialiser le PIN",
      success: "PIN de l’utilisateur réinitialisé avec succès.",
      resultTitle: "PIN par défaut rétabli",
      resultWarning:
        "Le PIN est désormais {value}. Communiquez-le à l’utilisateur et demandez-lui de le modifier.",
      done: "Terminé",
    },
    resetPassword: {
      actionTitle: "Réinitialiser le mot de passe",
      title: "Réinitialiser le mot de passe de l’utilisateur",
      description:
        "Réinitialisez le mot de passe à {value} et révoquez les sessions de renouvellement existantes. L’utilisateur pourra modifier son mot de passe dans son profil après connexion.",
      reason: "Motif",
      reasonRequired: "Le motif est obligatoire.",
      submit: "Réinitialiser le mot de passe",
      success: "Mot de passe de l’utilisateur réinitialisé avec succès.",
      resultTitle: "Mot de passe par défaut rétabli",
      resultWarning:
        "Le mot de passe est désormais {value}. Communiquez-le à l’utilisateur et demandez-lui de le modifier dans son profil après connexion.",
      done: "Terminé",
    },
  },
  auditLogs: {
    badge: "Audit SaaS",
    title: "Journaux d’audit",
    centerTitle: "Audit et sécurité",
    activityDescription:
      "Consultez toutes les actions enregistrées sur la plateforme et les locataires, y compris les tentatives de connexion et les modifications de configuration.",
    securityDescription:
      "Analysez les événements de sécurité par gravité. Les échecs de connexion figurent aussi dans le journal d’audit.",
    loadError: "Impossible de charger les journaux d’audit.",
    emptyTitle: "Aucun journal d’audit trouvé",
    category: "Catégorie",
    eventType: "Type d’événement",
    allEventTypes: "Tous les types d’événements",
    result: "Résultat",
    actorUserId: "Identifiant de l’auteur",
    detail: {
      title: "Détail du journal d’audit",
      description: "Informations complètes de l’entrée d’audit sélectionnée.",
      id: "Identifiant",
      entityType: "Type d’entité",
      entityId: "Identifiant de l’entité",
      tenant: "Locataire",
      reason: "Motif",
      ipAddress: "Adresse IP",
      before: "Avant",
      after: "Après",
    },
    columns: {
      created: "Création",
      event: "Événement",
      entity: "Entité",
      actor: "Auteur",
    },
  },
  systemLogs: {
    badge: "Journaux d’activité SaaS",
    title: "Journaux d’activité",
    loadError: "Impossible de charger les journaux d’activité.",
    emptyTitle: "Aucun journal d’activité trouvé",
    level: "Niveau",
    service: "Service",
    servicePlaceholder: "cleanhub-api",
    tenantId: "Identifiant du locataire",
    columns: {
      created: "Création",
      message: "Message",
      tenant: "Locataire",
      actor: "Auteur",
      request: "Requête",
      none: "Aucun",
    },
    detail: {
      title: "Détail du journal d’activité",
      id: "Identifiant du journal",
      eventType: "Type d’événement",
      branch: "Succursale",
      metadata: "Métadonnées",
      noMetadata: "Aucune métadonnée enregistrée",
    },
  },
  backups: {
    badge: "Sauvegardes SaaS",
    title: "Sauvegardes des données",
    loadError: "Impossible de charger les sauvegardes.",
    restoreLoadError: "Impossible de charger les demandes de restauration.",
    emptyBackups: "Aucune tâche de sauvegarde trouvée",
    emptyRestores: "Aucune demande de restauration trouvée",
    restoreSection: "Demandes de restauration",
    selectBackupHint:
      "Sélectionnez une tâche de sauvegarde avant de soumettre une demande de restauration à un examen manuel.",
    manualBackup: "Sauvegarde manuelle",
    backupPhysicalScopeHint:
      "Le fichier contient toujours une sauvegarde complète de la base de données. Le périmètre locataire sert uniquement à rattacher la demande à un locataire pour l’examen manuel de la restauration.",
    scope: "Périmètre",
    reason: "Motif",
    backupReasonPlaceholder:
      "Note facultative pour le suivi de la tâche de sauvegarde",
    createBackupTask: "Créer une tâche de sauvegarde",
    backupCreated:
      "Sauvegarde mise en attente. Une restauration pourra être demandée après vérification.",
    restoreReason: "Motif de restauration",
    restoreReasonPlaceholder:
      "Expliquez pourquoi cette restauration nécessite un examen manuel",
    submitRestore: "Soumettre la demande de restauration",
    restoreSubmitted: "Demande de restauration soumise.",
    restoreRequiresSuccess:
      "La restauration ne peut être demandée qu’à partir d’une sauvegarde vérifiée et réussie.",
    columns: {
      created: "Création",
      requestedBy: "Demandé par",
      finished: "Fin",
      review: "Examen",
    },
    detail: {
      backupTask: "Tâche de sauvegarde",
      scope: "Périmètre :",
      status: "Statut :",
      tenant: "Locataire :",
      started: "Début :",
      finished: "Fin :",
      failure: "Échec :",
    },
    review: {
      approve: "Approuver",
      reject: "Rejeter",
      complete: "Confirmer la fin de la restauration manuelle",
      cancel: "Annuler la demande",
      reviewNote: "Note d’examen",
      reviewNotePlaceholder:
        "Obligatoire pour confirmer une restauration manuelle ; facultative sinon",
      applyNote: "Appliquer",
    },
    reviewToasts: {
      approved: "Demande de restauration approuvée.",
      rejected: "Demande de restauration rejetée.",
      completed: "Demande de restauration marquée comme terminée.",
      cancelled: "Demande de restauration annulée.",
      failed: "Échec de l’examen de la restauration.",
    },
    restoreColumns: {
      reviewer: "Examinateur",
      reviewedAt: "Date d’examen",
      reviewNote: "Note d’examen",
      actions: "Actions",
    },
    storageMetadata: {
      title: "Métadonnées de stockage",
      dumpUrl: "URL de la sauvegarde",
      dumpKey: "Fichier de sauvegarde",
      sizeBytes: "Taille en octets",
      checksum: "Somme de contrôle",
      storageType: "Type de stockage",
      notCaptured:
        "Renseigné après le traitement de cette tâche par le service de sauvegarde.",
    },
  },
  platformSettings: {
    badge: "Plateforme SaaS",
    title: "Paramètres de la plateforme",
    loadError: "Impossible de charger les paramètres de la plateforme.",
    saveSuccess: "Paramètres de la plateforme enregistrés avec succès.",
    defaultConfig: "Configuration par défaut",
    defaultLanguage: "Langue par défaut",
    defaultCurrency: "Devise par défaut",
    timezone: "Fuseau horaire",
    maintenanceMode: "Mode maintenance",
    lastUpdated: "Dernière mise à jour :",
    saveSettings: "Enregistrer les paramètres",
    workspace: {
      subtitle: "Paramètres SaaS",
      searchLabel: "Rechercher un paramètre",
      searchPlaceholder: "Trouver un paramètre",
      noResults: "Aucun paramètre correspondant",
      closeLabel: "Fermer les paramètres",
      sections: {
        defaults: {
          title: "Valeurs par défaut de la plateforme",
          description:
            "Langue, devise et fuseau horaire des nouveaux locataires.",
        },
        taxTemplates: {
          title: "Modèles fiscaux",
          description:
            "Valeurs fiscales par pays appliquées lors de la création des locataires.",
        },
        itemCatalog: {
          title: "Catalogue des articles de service",
          description:
            "Gérez les types, les articles et leur disponibilité pour les locataires.",
        },
        security: {
          title: "Politique de sécurité",
          description:
            "Exigences de mot de passe et règles de verrouillage de connexion.",
        },
        maintenance: {
          title: "Mode maintenance",
          description:
            "Contrôlez les accès en écriture des locataires pendant la maintenance.",
        },
      },
      maintenanceHint:
        "Si cette option est activée, les requêtes d’écriture des locataires sont bloquées. Les administrateurs SaaS peuvent continuer à gérer la plateforme.",
      securityEvents: "Voir les événements de sécurité",
    },
  },
  security: {
    page: {
      badge: "Sécurité SaaS",
      title: "Événements de sécurité",
      refreshSettings: "Actualiser les paramètres",
      loadError: "Impossible de charger les paramètres de sécurité.",
    },
    settings: {
      title: "Paramètres de sécurité",
      saveSuccess: "Paramètres de sécurité mis à jour.",
      passwordMinLength: "Longueur minimale du mot de passe",
      loginMaxAttempts: "Nombre maximal de tentatives de connexion",
      lockoutMinutes: "Durée du verrouillage en minutes",
      refreshTokenDays: "Validité du jeton de renouvellement en jours",
      requireNumber: "Exiger un chiffre",
      requireSymbol: "Exiger un caractère spécial",
      saveSettings: "Enregistrer les paramètres",
    },
    events: {
      title: "Événements de sécurité",
      refreshEvents: "Actualiser les événements",
      loadError: "Impossible de charger les événements de sécurité.",
      emptyTitle: "Aucun événement de sécurité trouvé",
      severity: "Gravité",
      eventType: "Type d’événement",
      eventTypePlaceholder: "login_failed",
      tenantId: "Identifiant du locataire",
      noDescription: "Aucune description",
      detailTitle: "Détail de l’événement de sécurité",
      eventId: "Identifiant de l’événement",
      branch: "Succursale",
      userAgent: "Agent utilisateur",
      metadata: "Métadonnées",
      notCaptured: "Non enregistré",
      noMetadata: "Aucune métadonnée",
      columns: {
        created: "Création",
        description: "Description",
        tenant: "Locataire",
        actor: "Auteur",
        ip: "IP",
      },
    },
  },
  feedbackTickets: {
    badge: "Retours SaaS",
    title: "Tickets de retour",
    loadError: "Impossible de charger les retours.",
    emptyTitle: "Aucun ticket de retour trouvé",
    priority: "Priorité",
    tenantId: "Identifiant du locataire",
    assigneeId: "Identifiant du responsable",
    assigneePlaceholder: "ULID d’un utilisateur SaaS facultatif",
    columns: {
      ticket: "Ticket",
      tenant: "Locataire",
      assignee: "Responsable",
      created: "Création",
      sla: "SLA",
    },
    detail: "Détails",
    detailTitle: "Détail du ticket",
    selectHint:
      "Sélectionnez un ticket de retour pour consulter ses détails et mettre à jour son traitement.",
    fields: {
      title: "Titre",
      description: "Description",
      noDescription: "Aucune description fournie.",
      reporter: "Signalé par :",
      source: "Source :",
      updated: "Mise à jour :",
    },
    status: {
      updated: "Statut du retour mis à jour.",
      label: "Statut",
      reason: "Motif",
      reasonPlaceholder: "Note facultative pour le journal d’audit",
      submit: "Mettre à jour le statut",
    },
    assignee: {
      updated: "Responsable du retour mis à jour.",
      label: "Identifiant du responsable",
      placeholder: "ULID d’un utilisateur SaaS, ou laisser vide",
      submit: "Mettre à jour le responsable",
    },
    batch: {
      ariaLabel: "Actions groupées",
      selected: "sélectionné(s)",
      selectAll: "Tout sélectionner",
      clear: "Effacer la sélection",
      applyStatus: "Définir le statut",
      reassign: "Réattribuer",
      close: "Fermer les tickets",
      noneSelected:
        "Sélectionnez des tickets pour activer les actions groupées",
      statusLabel: "Nouveau statut",
      assigneeLabel: "ULID du responsable",
      submitStatus: "Appliquer le statut",
      submitAssignee: "Attribuer le responsable",
      reason: "Motif",
      reasonPlaceholder: "Note facultative pour le journal d’audit",
      closeReason: "Motif de fermeture",
      closeReasonPlaceholder: "Note facultative pour le journal d’audit",
      statusApplied: "Statut mis à jour pour tous les tickets sélectionnés.",
      statusPartial:
        "Certains tickets sélectionnés n’ont pas pu être mis à jour.",
      statusFailed: "Impossible de mettre à jour les tickets sélectionnés.",
      assigneeApplied: "Tous les tickets sélectionnés ont été réattribués.",
      assigneePartial:
        "Certains tickets sélectionnés n’ont pas pu être réattribués.",
      assigneeFailed: "Impossible de réattribuer les tickets sélectionnés.",
      closed: "Tous les tickets sélectionnés ont été fermés.",
      closedPartial: "Certains tickets sélectionnés n’ont pas pu être fermés.",
      closedFailed: "Impossible de fermer les tickets sélectionnés.",
    },
    sla: {
      label: "SLA",
      met: "Respecté",
      onTrack: "Dans les délais",
      left: "restant",
      overdue: "en retard",
      lessThanHourLeft: "< 1 h",
      overDueAria: "Délai de service dépassé",
      dueSoonAria: "Échéance du délai de service proche",
    },
    timeline: {
      title: "Historique des statuts",
      empty: "Aucune modification de statut enregistrée.",
      created: "Création",
      updated: "Mis à jour",
    },
  },
  profile: {
    intro:
      "Gérez votre compte sur la plateforme et la sécurité de vos connexions.",
    identityTitle: "Informations personnelles",
    identityDescription:
      "Votre nom et vos coordonnées sont visibles par les opérateurs de la plateforme.",
    preferencesTitle: "Préférences",
    preferencesDescription:
      "Choisissez la langue et le fuseau horaire utilisés par votre compte.",
    securityTitle: "Modifier le mot de passe",
    securityDescription:
      "Saisissez votre mot de passe actuel pour en définir un nouveau.",
    displayName: "Nom affiché",
    email: "E-mail",
    phone: "Téléphone",
    language: "Langue",
    timezone: "Fuseau horaire",
    timezoneHint: "Sélectionnez votre fuseau horaire dans la liste.",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    passwordHint: "Au moins {count} caractères{number}{symbol}.",
    numberRequirement: ", dont un chiffre",
    symbolRequirement: " et un caractère spécial",
    passwordReauth:
      "Cet appareil sera immédiatement déconnecté. Les autres appareils devront se reconnecter à l’expiration de leur accès actuel.",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    changePassword: "Modifier le mot de passe",
    discard: "Annuler les modifications",
    saved: "Profil enregistré.",
    passwordChanged: "Mot de passe modifié. Veuillez vous reconnecter.",
    saveFailed: "Impossible d’enregistrer votre profil.",
    passwordFailed: "Impossible de modifier votre mot de passe.",
    required: "Ce champ est obligatoire.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
    invalidPhone: "Saisissez un numéro de téléphone valide.",
    invalidTimezone: "Sélectionnez un fuseau horaire valide.",
    passwordMismatch: "Les nouveaux mots de passe ne correspondent pas.",
    passwordSame: "Choisissez un mot de passe différent.",
    currentPasswordIncorrect: "Le mot de passe actuel est incorrect.",
    emailConflict: "Cette adresse e-mail est déjà utilisée.",
    phoneConflict: "Ce numéro de téléphone est déjà utilisé.",
  },
  placeholders: {
    profile: {
      title: "Espace personnel",
      description:
        "Profil personnel, préférences du compte, gestion du mot de passe et identité de l’opérateur de la plateforme.",
      items: ["Profil", "Sécurité", "Langue", "Sessions"],
    },
    featureFlags: {
      title: "Fonctionnalités",
      description:
        "Options de la plateforme pour gérer le déploiement des locataires, les expérimentations et la visibilité des modules.",
      items: [
        "Déploiement des locataires",
        "Activation des modules",
        "Expérimentations",
        "Notes de version",
      ],
    },
    localization: {
      title: "Paramètres régionaux",
      description:
        "Valeurs globales de langue, devise, fuseau horaire et région pour les locataires gérés par la plateforme.",
      items: ["Langues", "Devises", "Fuseaux horaires", "Formats régionaux"],
    },
  },
  todoCenter: {
    openTodoCenter: "Ouvrir mes tâches",
    emptyTitle: "Vous êtes à jour",
    emptyBody:
      "Aucune action à traiter parmi les retours, les demandes de restauration et les événements de sécurité.",
    badge: "Mes tâches",
    title: "Mes tâches",
    description:
      "Actions à traiter parmi les tickets de retour, les restaurations en attente d’examen et les événements de sécurité graves.",
    loadError: "Impossible de charger vos tâches.",
    total: "Total à traiter",
    untitled: "Sans titre",
    feedbackQueue: {
      title: "Tickets de retour ouverts",
      description: "Tickets en attente de réponse ou en cours de traitement.",
      empty: "Aucun ticket de retour ouvert.",
      viewAll: "Voir tous les tickets de retour",
    },
    restoreQueue: {
      title: "Restaurations en attente d’examen",
      description:
        "Demandes de restauration en attente d’approbation ou de rejet.",
      empty: "Aucune restauration en attente d’examen.",
      viewAll: "Voir toutes les demandes de restauration",
    },
    securityQueue: {
      title: "Événements de sécurité graves",
      description:
        "Événements de gravité élevée ou critique nécessitant une intervention.",
      empty: "Aucun événement de sécurité grave.",
      viewAll: "Voir tous les événements de sécurité",
    },
  },
};
