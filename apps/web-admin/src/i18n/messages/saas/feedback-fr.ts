/** Operator-facing validation and request errors. Protocol codes remain unchanged. */
export const saasFeedbackFr: Readonly<Record<string, string>> = {
  "The item catalog could not be loaded. Retry before continuing.":
    "Impossible de charger le catalogue. Réessayez avant de continuer.",
  "Failed to create backup task.":
    "Impossible de créer la tâche de sauvegarde.",
  "Failed to submit restore request.":
    "Impossible de soumettre la demande de restauration.",
  "Failed to review restore request.":
    "Impossible d’examiner la demande de restauration.",
  "Select a valid backup scope.":
    "Sélectionnez un périmètre de sauvegarde valide.",
  "Tenant ID must be a valid ULID.":
    "L’identifiant du locataire doit être un ULID valide.",
  "Tenant ID is required for tenant-scoped requests.":
    "L’identifiant du locataire est obligatoire pour les demandes à ce périmètre.",
  "Backup reason must be 500 characters or fewer.":
    "Le motif de sauvegarde ne doit pas dépasser 500 caractères.",
  "Restore request reason is required.":
    "Le motif de la demande de restauration est obligatoire.",
  "Restore request reason must be 500 characters or fewer.":
    "Le motif de restauration ne doit pas dépasser 500 caractères.",
  "Failed to update feedback ticket assignee.":
    "Impossible de modifier le responsable du ticket de retour.",
  "Failed to update feedback ticket status.":
    "Impossible de modifier le statut du ticket de retour.",
  "Select a valid feedback status.": "Sélectionnez un statut de retour valide.",
  "Status update reason must be 500 characters or fewer.":
    "Le motif du changement de statut ne doit pas dépasser 500 caractères.",
  "Assignee user ID must be a valid ULID.":
    "L’identifiant du responsable doit être un ULID valide.",
  "Failed to update platform settings.":
    "Impossible de mettre à jour les paramètres de la plateforme.",
  "Failed to update security settings.":
    "Impossible de mettre à jour les paramètres de sécurité.",
  "Password must be 128 characters or fewer.":
    "Le mot de passe ne doit pas dépasser 128 caractères.",
  "Password must contain at least one number.":
    "Le mot de passe doit contenir au moins un chiffre.",
  "Password must contain at least one symbol.":
    "Le mot de passe doit contenir au moins un caractère spécial.",
  "Password minimum length must be at least 6.":
    "La longueur minimale du mot de passe doit être d’au moins 6 caractères.",
  "Password minimum length must be 128 or fewer.":
    "La longueur minimale du mot de passe ne doit pas dépasser 128 caractères.",
  "Login max attempts must be at least 1.":
    "Le nombre maximal de tentatives de connexion doit être d’au moins 1.",
  "Login max attempts must be 20 or fewer.":
    "Le nombre maximal de tentatives de connexion ne doit pas dépasser 20.",
  "Lockout minutes must be at least 1.":
    "La durée du verrouillage doit être d’au moins 1 minute.",
  "Lockout minutes must be 1440 or fewer.":
    "La durée du verrouillage ne doit pas dépasser 1440 minutes.",
  "Refresh token days must be at least 1.":
    "La validité du jeton de renouvellement doit être d’au moins 1 jour.",
  "Refresh token days must be 365 or fewer.":
    "La validité du jeton de renouvellement ne doit pas dépasser 365 jours.",
  "Only super admins can create tenants.":
    "Seuls les super administrateurs peuvent créer des locataires.",
  "Please correct the highlighted fields.": "Corrigez les champs indiqués.",
  "Tenant could not be created.": "Impossible de créer le locataire.",
  "You do not have permission to offboard tenants.":
    "Vous n’avez pas l’autorisation de clôturer des locataires.",
  "Reason is required.": "Le motif est obligatoire.",
  "You do not have permission to update tenant status.":
    "Vous n’avez pas l’autorisation de modifier le statut du locataire.",
  "Tenant request failed.": "Échec de la requête concernant le locataire.",
  "The tenant request timed out. Please try again.":
    "Le délai de la requête concernant le locataire a expiré. Veuillez réessayer.",
  "The tenant request could not reach the API. Check the API service and try again.":
    "Impossible de joindre l’API pour cette requête. Vérifiez le service API et réessayez.",
  "Your session has expired. Please sign in again.":
    "Votre session a expiré. Veuillez vous reconnecter.",
  "You do not have permission to access this tenant area.":
    "Vous n’avez pas l’autorisation d’accéder à cet espace locataire.",
  "Tenant was not found.": "Locataire introuvable.",
  "The tenant was changed by another request.":
    "Le locataire a été modifié par une autre requête.",
  "Please correct the tenant request.":
    "Corrigez la demande concernant le locataire.",
  "A tenant with this code already exists.":
    "Un locataire avec ce code existe déjà.",
  "A tenant user with this email already exists.":
    "Un utilisateur de locataire avec cette adresse e-mail existe déjà.",
  "This tenant already has an active owner.":
    "Ce locataire possède déjà un propriétaire actif.",
  "Tenant request conflicts with current data.":
    "La demande concernant le locataire est incompatible avec les données actuelles.",
  "Tenant settings could not be updated.":
    "Impossible de mettre à jour les paramètres du locataire.",
  "Tenant settings updates require Super Admin or SaaS tenant write permission.":
    "La modification des paramètres du locataire exige le rôle de super administrateur ou le droit d’écriture SaaS sur les locataires.",
  "Tenant settings conflict with current data.":
    "Les paramètres du locataire sont incompatibles avec les données actuelles.",
  "Tenant feature flags could not be updated.":
    "Impossible de mettre à jour les fonctionnalités du locataire.",
  "Tenant feature flag updates require Super Admin or SaaS tenant write permission.":
    "La modification des fonctionnalités exige le rôle de super administrateur ou le droit d’écriture SaaS sur les locataires.",
  "Tenant feature flags conflict with current data.":
    "Les fonctionnalités du locataire sont incompatibles avec les données actuelles.",
  "Tenant status could not be updated.":
    "Impossible de mettre à jour le statut du locataire.",
  "Tenant status could not be updated right now.":
    "Impossible de modifier le statut du locataire pour le moment.",
  "Please correct the tenant status request.":
    "Corrigez la demande de changement de statut du locataire.",
  "Tenant updates require Super Admin or SaaS tenant write permission.":
    "La modification du locataire exige le rôle de super administrateur ou le droit d’écriture SaaS sur les locataires.",
  "Tenant could not be updated.": "Impossible de mettre à jour le locataire.",
  "Merchant name is required.": "Le nom du commerçant est obligatoire.",
  "Merchant name must be 160 characters or fewer.":
    "Le nom du commerçant ne doit pas dépasser 160 caractères.",
  "Tenant code is required.": "Le code du locataire est obligatoire.",
  "Tenant code must be 80 characters or fewer.":
    "Le code du locataire ne doit pas dépasser 80 caractères.",
  "Country is required.": "Le pays est obligatoire.",
  "Country must be 80 characters or fewer.":
    "Le pays ne doit pas dépasser 80 caractères.",
  "Enter a valid email address.": "Saisissez une adresse e-mail valide.",
  "Email must be 320 characters or fewer.":
    "L’adresse e-mail ne doit pas dépasser 320 caractères.",
  "City must be 120 characters or fewer.":
    "Le nom de la ville ne doit pas dépasser 120 caractères.",
  "Contact name must be 120 characters or fewer.":
    "Le nom du contact ne doit pas dépasser 120 caractères.",
  "Contact phone must be 32 characters or fewer.":
    "Le téléphone du contact ne doit pas dépasser 32 caractères.",
  "Select a valid default language.":
    "Sélectionnez une langue par défaut valide.",
  "Currency must be a 3-letter code.":
    "La devise doit être un code de 3 lettres.",
  "Owner name is required.": "Le nom du propriétaire est obligatoire.",
  "Owner name must be 120 characters or fewer.":
    "Le nom du propriétaire ne doit pas dépasser 120 caractères.",
  "Owner email is required.":
    "L’adresse e-mail du propriétaire est obligatoire.",
  "Enter a valid owner email address.":
    "Saisissez une adresse e-mail valide pour le propriétaire.",
  "Owner email must be 320 characters or fewer.":
    "L’adresse e-mail du propriétaire ne doit pas dépasser 320 caractères.",
  "Owner phone must be 32 characters or fewer.":
    "Le téléphone du propriétaire ne doit pas dépasser 32 caractères.",
  "Feature flags must be enabled or disabled.":
    "Chaque fonctionnalité doit être activée ou désactivée.",
  "Failed to reset SaaS user password.":
    "Impossible de réinitialiser le mot de passe de l’utilisateur SaaS.",
  "A reason between 1 and 500 characters is required.":
    "Un motif de 1 à 500 caractères est obligatoire.",
  "Could not reset user credentials.":
    "Impossible de réinitialiser les identifiants de l’utilisateur.",
  "Only active and disabled status changes are supported.":
    "Seules les transitions vers les statuts actif et désactivé sont prises en charge.",
  "Email is required.": "L’adresse e-mail est obligatoire.",
  "Email must be valid.": "L’adresse e-mail doit être valide.",
  "Phone must be 3 to 32 characters.":
    "Le téléphone doit comporter de 3 à 32 caractères.",
  "Phone must use numbers and common phone symbols.":
    "Le téléphone doit contenir des chiffres et des symboles téléphoniques usuels.",
  "Display name is required.": "Le nom affiché est obligatoire.",
  "Display name must be 120 characters or fewer.":
    "Le nom affiché ne doit pas dépasser 120 caractères.",
  "Select a valid SaaS role.": "Sélectionnez un rôle SaaS valide.",
  "Select a valid language.": "Sélectionnez une langue valide.",
  "Timezone is required.": "Le fuseau horaire est obligatoire.",
  "Select at least one SaaS role.": "Sélectionnez au moins un rôle SaaS.",
  "Select valid SaaS roles only.":
    "Sélectionnez uniquement des rôles SaaS valides.",
  "Tenant service is temporarily unavailable.":
    "Le service des locataires est temporairement indisponible.",
  Unauthorized: "Connexion requise.",
  Forbidden: "Accès refusé.",
  "Internal server error": "Erreur interne du serveur.",
  "Not Found": "Ressource introuvable.",
  "Failed to fetch":
    "Impossible de joindre le serveur. Vérifiez votre connexion.",
  "Network request failed": "Échec de la connexion au serveur.",
  "Invalid credentials.": "Identifiants incorrects.",
  "Invalid credentials": "Identifiants incorrects.",
};
