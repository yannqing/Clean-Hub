import type { SupportedLocale } from "@cleanhub/i18n/locales";

/**
 * Localised API error messages, keyed by the English message itself.
 *
 * Keyed by text rather than by error code because a code is not a message:
 * VALIDATION_ERROR alone covers 48 distinct refusals and CASH_SESSION_REQUIRED
 * nine. Collapsing those onto their code would tell a cashier "validation
 * failed" where the English told them which field was wrong.
 *
 * Keyed by text rather than by a derived slug so a message and its translation
 * cannot silently drift: change the English at a throw site and the lookup
 * misses, which `error-messages.smoke.ts` reports by name. A miss falls back to
 * the English, so a missing translation degrades to today's behaviour rather
 * than to a blank string or a raw key.
 *
 * Scope is the POS and auth modules -- the paths a cashier reaches with a
 * customer waiting. Back-office modules keep their English messages; those
 * surface in web-admin, which has its own front-end copy layer.
 */
const POS_ERROR_MESSAGES: Readonly<
  Record<string, Readonly<Record<SupportedLocale, string>>>
> = {
  "A POS terminal session cannot access back-office resources.": {
    en: "A POS terminal session cannot access back-office resources.",
    fr: "Une session de caisse ne peut pas accéder aux ressources d'administration.",
    "zh-CN": "POS 终端会话不能访问后台管理资源。",
  },
  "A tenant session is required for this resource.": {
    en: "A tenant session is required for this resource.",
    fr: "Une session locataire est obligatoire pour cette ressource.",
    "zh-CN": "访问该资源需要租户会话。",
  },
  "Access token is required.": {
    en: "Access token is required.",
    fr: "Un jeton d'accès est obligatoire.",
    "zh-CN": "需要提供访问令牌。",
  },
  "Bearer access token is required.": {
    en: "Bearer access token is required.",
    fr: "Un jeton d'accès Bearer est obligatoire.",
    "zh-CN": "需要提供 Bearer 访问令牌。",
  },
  "Set a new password before using the app.": {
    en: "Set a new password before using the app.",
    fr: "Définissez un nouveau mot de passe avant d'utiliser l'application.",
    "zh-CN": "使用应用前请先设置新密码。",
  },
  "Internal server error.": {
    en: "Internal server error.",
    fr: "Erreur interne du serveur.",
    "zh-CN": "服务器内部错误。",
  },
  "Request validation failed.": {
    en: "Request validation failed.",
    fr: "La validation de la requête a échoué.",
    "zh-CN": "请求校验未通过。",
  },
  "A Manager may enroll a POS terminal only for their single assigned branch.": {
    en: "A Manager may enroll a POS terminal only for their single assigned branch.",
    fr: "Un responsable ne peut enregistrer une caisse que pour son unique magasin assigné.",
    "zh-CN": "经理只能为自己所属的唯一门店绑定 POS 终端。",
  },
  "A catalog service is required for every ticket item.": {
    en: "A catalog service is required for every ticket item.",
    fr: "Un service du catalogue est obligatoire pour chaque article du bon.",
    "zh-CN": "每个工单项目都必须选择目录中的服务。",
  },
  "A catalog service or product is required for every order item.": {
    en: "A catalog service or product is required for every order item.",
    fr: "Un service ou un produit du catalogue est obligatoire pour chaque ligne de commande.",
    "zh-CN": "每个订单项目都必须选择目录中的服务或商品。",
  },
  "A checkout can contain at most one pending card or mobile-money tender.": {
    en: "A checkout can contain at most one pending card or mobile-money tender.",
    fr: "Un encaissement ne peut contenir qu'un seul paiement carte ou mobile en attente.",
    "zh-CN": "一次结款最多只能有一笔待处理的银行卡或移动支付。",
  },
  "A closing cash count is required before closing this register.": {
    en: "A closing cash count is required before closing this register.",
    fr: "Un comptage de clôture est obligatoire avant de fermer cette caisse.",
    "zh-CN": "关闭收银台前必须完成现金盘点。",
  },
  "A customer account with this email already exists.": {
    en: "A customer account with this email already exists.",
    fr: "Un compte client avec cet e-mail existe déjà.",
    "zh-CN": "该邮箱已存在客户账户。",
  },
  "A customer account with this phone already exists.": {
    en: "A customer account with this phone already exists.",
    fr: "Un compte client avec ce téléphone existe déjà.",
    "zh-CN": "该手机号已存在客户账户。",
  },
  "A customer profile is required for non-retail services.": {
    en: "A customer profile is required for non-retail services.",
    fr: "Une fiche client est obligatoire pour les services hors vente directe.",
    "zh-CN": "非零售服务必须关联客户档案。",
  },
  "A non-cash refund can be completed only with the provider settlement reference.": {
    en: "A non-cash refund can be completed only with the provider settlement reference.",
    fr: "Un remboursement autre qu'en espèces ne peut être finalisé qu'avec la référence de règlement du prestataire.",
    "zh-CN": "非现金退款必须提供支付机构的结算参考号才能完成。",
  },
  "A positive whole-number quantity is required for a per-item service.": {
    en: "A positive whole-number quantity is required for a per-item service.",
    fr: "Une quantité entière positive est obligatoire pour un service à la pièce.",
    "zh-CN": "按件计费的服务必须填写正整数数量。",
  },
  "A positive whole-number quantity is required for a product.": {
    en: "A positive whole-number quantity is required for a product.",
    fr: "Une quantité entière positive est obligatoire pour un produit.",
    "zh-CN": "商品必须填写正整数数量。",
  },
  "A provider settlement reference is required for a non-cash refund.": {
    en: "A provider settlement reference is required for a non-cash refund.",
    fr: "Une référence de règlement du prestataire est obligatoire pour un remboursement autre qu'en espèces.",
    "zh-CN": "非现金退款必须填写支付机构的结算参考号。",
  },
  "A register session could not be opened for this payment.": {
    en: "A register session could not be opened for this payment.",
    fr: "Aucune session de caisse n'a pu être ouverte pour ce paiement.",
    "zh-CN": "无法为这笔收款开启收银台会话。",
  },
  "A returned quantity exceeds the remaining purchased quantity.": {
    en: "A returned quantity exceeds the remaining purchased quantity.",
    fr: "Une quantité retournée dépasse la quantité achetée restante.",
    "zh-CN": "退货数量超过了剩余可退数量。",
  },
  "A settlement reference was supplied for a payment that is not part of this refund.": {
    en: "A settlement reference was supplied for a payment that is not part of this refund.",
    fr: "Une référence de règlement a été fournie pour un paiement qui ne fait pas partie de ce remboursement.",
    "zh-CN": "提供的结算参考号对应的收款不属于本次退款。",
  },
  "A stable client-generated order id is required for checkout recovery.": {
    en: "A stable client-generated order id is required for checkout recovery.",
    fr: "Un identifiant de commande stable généré par le client est obligatoire pour reprendre un encaissement.",
    "zh-CN": "补传结款必须提供客户端生成的固定订单号。",
  },
  "A ticket item cannot appear in the cart more than once.": {
    en: "A ticket item cannot appear in the cart more than once.",
    fr: "Un article de bon ne peut pas figurer plusieurs fois dans le panier.",
    "zh-CN": "同一个工单项目不能重复加入购物车。",
  },
  "A ticket item cannot be added to the same cart more than once.": {
    en: "A ticket item cannot be added to the same cart more than once.",
    fr: "Un article de bon ne peut pas être ajouté deux fois au même panier.",
    "zh-CN": "同一个工单项目不能重复加入同一个购物车。",
  },
  "Access token is invalid.": {
    en: "Access token is invalid.",
    fr: "Le jeton d'accès n'est pas valide.",
    "zh-CN": "访问令牌无效。",
  },
  "Access token subject is missing.": {
    en: "Access token subject is missing.",
    fr: "Le sujet du jeton d'accès est absent.",
    "zh-CN": "访问令牌缺少主体信息。",
  },
  "Access token tenant no longer matches the user account.": {
    en: "Access token tenant no longer matches the user account.",
    fr: "Le locataire du jeton d'accès ne correspond plus au compte utilisateur.",
    "zh-CN": "访问令牌的租户与该用户账号已不匹配。",
  },
  "Access token user is invalid.": {
    en: "Access token user is invalid.",
    fr: "L'utilisateur du jeton d'accès n'est pas valide.",
    "zh-CN": "访问令牌对应的用户无效。",
  },
  "Active settings were not found for the authenticated terminal.": {
    en: "Active settings were not found for the authenticated terminal.",
    fr: "Aucun réglage actif n'a été trouvé pour la caisse authentifiée.",
    "zh-CN": "未找到该已认证终端的有效设置。",
  },
  "Active settings were not found for this POS terminal.": {
    en: "Active settings were not found for this POS terminal.",
    fr: "Aucun réglage actif n'a été trouvé pour cette caisse.",
    "zh-CN": "未找到该 POS 终端的有效设置。",
  },
  "All cart items must belong to the selected branch.": {
    en: "All cart items must belong to the selected branch.",
    fr: "Tous les articles du panier doivent appartenir au magasin sélectionné.",
    "zh-CN": "购物车中的所有项目必须属于所选门店。",
  },
  "All cart items must use the branch currency.": {
    en: "All cart items must use the branch currency.",
    fr: "Tous les articles du panier doivent utiliser la devise du magasin.",
    "zh-CN": "购物车中的所有项目必须使用门店币种。",
  },
  "All personal cash sessions must be counted and closed before the register can close.": {
    en: "All personal cash sessions must be counted and closed before the register can close.",
    fr: "Toutes les sessions de fonds personnels doivent être comptées et clôturées avant la fermeture de la caisse.",
    "zh-CN": "所有员工的随身现金会话都盘点并关闭后，才能关闭收银台。",
  },
  "All service ticket items in a cart must belong to the same customer.": {
    en: "All service ticket items in a cart must belong to the same customer.",
    fr: "Tous les articles de bon d'un panier doivent appartenir au même client.",
    "zh-CN": "购物车中的所有工单项目必须属于同一位客户。",
  },
  "All ticket items in a cart must belong to the same customer.": {
    en: "All ticket items in a cart must belong to the same customer.",
    fr: "Tous les articles de bon d'un panier doivent appartenir au même client.",
    "zh-CN": "购物车中的所有工单项目必须属于同一位客户。",
  },
  "An enrolled POS terminal is required for shift operations.": {
    en: "An enrolled POS terminal is required for shift operations.",
    fr: "Une caisse enregistrée est obligatoire pour les opérations de service.",
    "zh-CN": "班次操作需要已绑定的 POS 终端。",
  },
  "An enrolled POS terminal session is required for POS operations.": {
    en: "An enrolled POS terminal session is required for POS operations.",
    fr: "Une session de caisse enregistrée est obligatoire pour les opérations POS.",
    "zh-CN": "POS 操作需要已绑定终端的有效会话。",
  },
  "An enrolled POS terminal session is required for hardware actions.": {
    en: "An enrolled POS terminal session is required for hardware actions.",
    fr: "Une session de caisse enregistrée est obligatoire pour les actions matérielles.",
    "zh-CN": "硬件操作需要已绑定终端的有效会话。",
  },
  "An opening cash amount is required to start cash tracking.": {
    en: "An opening cash amount is required to start cash tracking.",
    fr: "Un montant d'ouverture est obligatoire pour démarrer le suivi des espèces.",
    "zh-CN": "开始现金跟踪必须填写开柜备用金。",
  },
  "Archived notifications cannot be marked as read.": {
    en: "Archived notifications cannot be marked as read.",
    fr: "Une notification archivée ne peut pas être marquée comme lue.",
    "zh-CN": "已归档的通知不能标记为已读。",
  },
  "At least one of phone or email is required.": {
    en: "At least one of phone or email is required.",
    fr: "Un téléphone ou un e-mail au moins est obligatoire.",
    "zh-CN": "手机号和邮箱至少填写一项。",
  },
  "At least one ticket item is required to create an order.": {
    en: "At least one ticket item is required to create an order.",
    fr: "Au moins un article de bon est obligatoire pour créer une commande.",
    "zh-CN": "创建订单至少需要一个工单项目。",
  },
  "Authenticated user identity is no longer available.": {
    en: "Authenticated user identity is no longer available.",
    fr: "L'identité de l'utilisateur authentifié n'est plus disponible.",
    "zh-CN": "已认证的用户身份不再有效。",
  },
  "Automatic discounts are controlled by their eligibility rules.": {
    en: "Automatic discounts are controlled by their eligibility rules.",
    fr: "Les remises automatiques sont régies par leurs règles d'éligibilité.",
    "zh-CN": "自动优惠由其适用规则控制。",
  },
  "Branch assignment exceeds allowed scope.": {
    en: "Branch assignment exceeds allowed scope.",
    fr: "L'affectation de magasin dépasse la portée autorisée.",
    "zh-CN": "门店分配超出了允许范围。",
  },
  "Branch was not found.": {
    en: "Branch was not found.",
    fr: "Magasin introuvable.",
    "zh-CN": "未找到门店。",
  },
  "Cannot create a profile under a disabled customer account.": {
    en: "Cannot create a profile under a disabled customer account.",
    fr: "Impossible de créer une fiche sous un compte client désactivé.",
    "zh-CN": "不能在已停用的客户账户下创建档案。",
  },
  "Cash handling must be disabled exactly when cash payments are disabled.": {
    en: "Cash handling must be disabled exactly when cash payments are disabled.",
    fr: "La gestion des espèces doit être désactivée exactement lorsque les paiements en espèces le sont.",
    "zh-CN": "现金管理必须与现金收款同时启用或同时停用。",
  },
  "Cash payments are disabled on this terminal.": {
    en: "Cash payments are disabled on this terminal.",
    fr: "Les paiements en espèces sont désactivés sur cette caisse.",
    "zh-CN": "此终端未启用现金收款。",
  },
  "Cash tender and occurrence time must be supplied together.": {
    en: "Cash tender and occurrence time must be supplied together.",
    fr: "Le montant reçu et l'heure de l'opération doivent être fournis ensemble.",
    "zh-CN": "实收现金和发生时间必须同时提供。",
  },
  "Cash-drawer results must reference a paid cash payment from the current branch.": {
    en: "Cash-drawer results must reference a paid cash payment from the current branch.",
    fr: "Un résultat de tiroir-caisse doit référencer un paiement en espèces réglé dans le magasin courant.",
    "zh-CN": "钱箱操作结果必须关联当前门店已支付的现金收款。",
  },
  "Cashiers cannot create terminal settings.": {
    en: "Cashiers cannot create terminal settings.",
    fr: "Un caissier ne peut pas créer les réglages de la caisse.",
    "zh-CN": "收银员不能创建终端设置。",
  },
  "Cashiers cannot update terminal settings.": {
    en: "Cashiers cannot update terminal settings.",
    fr: "Un caissier ne peut pas modifier les réglages de la caisse.",
    "zh-CN": "收银员不能修改终端设置。",
  },
  "Close the current register before changing its cash handling policy.": {
    en: "Close the current register before changing its cash handling policy.",
    fr: "Fermez la caisse en cours avant de modifier sa politique de gestion des espèces.",
    "zh-CN": "修改现金管理方式前请先关闭当前收银台。",
  },
  "Configure, verify, and enable Wave or Orange Money before enabling mobile payment on this terminal.": {
    en: "Configure, verify, and enable Wave or Orange Money before enabling mobile payment on this terminal.",
    fr: "Configurez, vérifiez et activez Wave ou Orange Money avant d'activer le paiement mobile sur cette caisse.",
    "zh-CN": "启用此终端的移动支付前，请先配置、验证并启用 Wave 或 Orange Money。",
  },
  "Correction would move the paid amount outside the order balance.": {
    en: "Correction would move the paid amount outside the order balance.",
    fr: "La correction ferait sortir le montant payé du solde de la commande.",
    "zh-CN": "该修正会使已收金额超出订单应收范围。",
  },
  "Customer account was not found.": {
    en: "Customer account was not found.",
    fr: "Compte client introuvable.",
    "zh-CN": "未找到客户账户。",
  },
  "Customer profile was not found.": {
    en: "Customer profile was not found.",
    fr: "Fiche client introuvable.",
    "zh-CN": "未找到客户档案。",
  },
  "Deferred or partial payment requires an identified customer.": {
    en: "Deferred or partial payment requires an identified customer.",
    fr: "Un paiement différé ou partiel exige un client identifié.",
    "zh-CN": "挂账或部分收款必须关联已识别的客户。",
  },
  "Deferred payment requires a future due date and a reason.": {
    en: "Deferred payment requires a future due date and a reason.",
    fr: "Un paiement différé exige une date d'échéance future et un motif.",
    "zh-CN": "挂账必须填写未来的到期日和原因。",
  },
  "Disabled customers cannot be used to create new tickets.": {
    en: "Disabled customers cannot be used to create new tickets.",
    fr: "Un client désactivé ne peut pas servir à créer un bon.",
    "zh-CN": "已停用的客户不能用于创建新工单。",
  },
  "Disabled customers cannot be used to create orders.": {
    en: "Disabled customers cannot be used to create orders.",
    fr: "Un client désactivé ne peut pas servir à créer une commande.",
    "zh-CN": "已停用的客户不能用于创建订单。",
  },
  "Discounts cannot be changed after an order is paid or finalized.": {
    en: "Discounts cannot be changed after an order is paid or finalized.",
    fr: "Les remises ne peuvent plus être modifiées après le paiement ou la finalisation d'une commande.",
    "zh-CN": "订单已收款或已完结后不能再修改优惠。",
  },
  "Each order item can appear only once in a return.": {
    en: "Each order item can appear only once in a return.",
    fr: "Chaque ligne de commande ne peut figurer qu'une fois dans un retour.",
    "zh-CN": "每个订单项目在一次退货中只能出现一次。",
  },
  "Email receipts are not enabled for this tenant.": {
    en: "Email receipts are not enabled for this tenant.",
    fr: "Les reçus par e-mail ne sont pas activés pour ce locataire.",
    "zh-CN": "该租户未启用邮件小票。",
  },
  "Failed to create refresh token.": {
    en: "Failed to create refresh token.",
    fr: "Échec de la création du jeton de rafraîchissement.",
    "zh-CN": "创建刷新令牌失败。",
  },
  "Failed to rotate refresh token.": {
    en: "Failed to rotate refresh token.",
    fr: "Échec du renouvellement du jeton de rafraîchissement.",
    "zh-CN": "轮换刷新令牌失败。",
  },
  "Finalized orders cannot accept payments.": {
    en: "Finalized orders cannot accept payments.",
    fr: "Une commande finalisée ne peut plus accepter de paiement.",
    "zh-CN": "已完结的订单不能再收款。",
  },
  "Finalized orders cannot be edited.": {
    en: "Finalized orders cannot be edited.",
    fr: "Une commande finalisée ne peut plus être modifiée.",
    "zh-CN": "已完结的订单不能再编辑。",
  },
  "Invalid credentials.": {
    en: "Invalid credentials.",
    fr: "Identifiants incorrects.",
    "zh-CN": "账号或密码错误。",
  },
  "No open register session was found for this terminal.": {
    en: "No open register session was found for this terminal.",
    fr: "Aucune session de caisse ouverte n'a été trouvée pour cette caisse.",
    "zh-CN": "未找到该终端已开启的收银台会话。",
  },
  "No open shift was found for this staff member.": {
    en: "No open shift was found for this staff member.",
    fr: "Aucun service ouvert n'a été trouvé pour cet employé.",
    "zh-CN": "未找到该员工已开始的班次。",
  },
  "Notification delivery was not found.": {
    en: "Notification delivery was not found.",
    fr: "Envoi de notification introuvable.",
    "zh-CN": "未找到该通知投递记录。",
  },
  "Offline cash exception was not found.": {
    en: "Offline cash exception was not found.",
    fr: "Incident de caisse hors ligne introuvable.",
    "zh-CN": "未找到该离线现金异常记录。",
  },
  "One or more selected ticket items were not found.": {
    en: "One or more selected ticket items were not found.",
    fr: "Un ou plusieurs articles de bon sélectionnés sont introuvables.",
    "zh-CN": "部分所选工单项目未找到。",
  },
  "One or more ticket items are already linked to an order.": {
    en: "One or more ticket items are already linked to an order.",
    fr: "Un ou plusieurs articles de bon sont déjà liés à une commande.",
    "zh-CN": "部分工单项目已关联订单。",
  },
  "Only a TPE card payment can receive a card outcome.": {
    en: "Only a TPE card payment can receive a card outcome.",
    fr: "Seul un paiement par carte TPE peut recevoir un résultat de carte.",
    "zh-CN": "只有 TPE 刷卡收款才能回写刷卡结果。",
  },
  "Only a failed email or SMS receipt delivery can be retried.": {
    en: "Only a failed email or SMS receipt delivery can be retried.",
    fr: "Seul un envoi de reçu par e-mail ou SMS en échec peut être relancé.",
    "zh-CN": "只有发送失败的邮件或短信小票才能重试。",
  },
  "Only a manager can close the register after personal cash sessions are closed.": {
    en: "Only a manager can close the register after personal cash sessions are closed.",
    fr: "Seul un responsable peut fermer la caisse une fois les fonds personnels clôturés.",
    "zh-CN": "员工随身现金会话关闭后，只有经理可以关闭收银台。",
  },
  "Only a non-empty active cart can be parked.": {
    en: "Only a non-empty active cart can be parked.",
    fr: "Seul un panier actif non vide peut être mis en attente.",
    "zh-CN": "只有非空的当前购物车才能挂单。",
  },
  "Only an order with a captured payment can be returned.": {
    en: "Only an order with a captured payment can be returned.",
    fr: "Seule une commande dont le paiement a été encaissé peut être retournée.",
    "zh-CN": "只有已实际收款的订单才能退货。",
  },
  "Only an owner or manager can resolve a manual mobile payment.": {
    en: "Only an owner or manager can resolve a manual mobile payment.",
    fr: "Seul un propriétaire ou un responsable peut valider un paiement mobile manuel.",
    "zh-CN": "只有店主或经理可以处理手工移动支付。",
  },
  "Only failed offline cash commands can be reported here.": {
    en: "Only failed offline cash commands can be reported here.",
    fr: "Seules les opérations de caisse hors ligne en échec peuvent être signalées ici.",
    "zh-CN": "这里只能上报失败的离线现金操作。",
  },
  "Only manual Wave or Orange Money payments can be resolved here.": {
    en: "Only manual Wave or Orange Money payments can be resolved here.",
    fr: "Seuls les paiements Wave ou Orange Money manuels peuvent être validés ici.",
    "zh-CN": "这里只能处理手工的 Wave 或 Orange Money 收款。",
  },
  "Only manual offline checkouts can be repriced for recovery.": {
    en: "Only manual offline checkouts can be repriced for recovery.",
    fr: "Seuls les encaissements hors ligne manuels peuvent être recalculés pour reprise.",
    "zh-CN": "只有手工离线结款才能重新计价以便补传。",
  },
  "Only printer hardware can be bound to an operating-system printer.": {
    en: "Only printer hardware can be bound to an operating-system printer.",
    fr: "Seul un matériel d'impression peut être lié à une imprimante du système.",
    "zh-CN": "只有打印机类设备才能绑定到系统打印机。",
  },
  "Only unpaid draft, received, or cancelled orders can be deleted.": {
    en: "Only unpaid draft, received, or cancelled orders can be deleted.",
    fr: "Seules les commandes impayées en brouillon, reçues ou annulées peuvent être supprimées.",
    "zh-CN": "只有未收款的草稿、已接单或已取消的订单才能删除。",
  },
  "Open a tracked cash session before recording cash movements.": {
    en: "Open a tracked cash session before recording cash movements.",
    fr: "Ouvrez une session de caisse suivie avant d'enregistrer des mouvements d'espèces.",
    "zh-CN": "记录现金流水前请先开启受跟踪的现金会话。",
  },
  "Open cash tracking and enter the starting cash before accepting cash.": {
    en: "Open cash tracking and enter the starting cash before accepting cash.",
    fr: "Ouvrez le suivi des espèces et saisissez le fonds de départ avant d'encaisser.",
    "zh-CN": "收取现金前请先开启现金跟踪并填写开柜备用金。",
  },
  "Order cannot be delivered before it is fully paid.": {
    en: "Order cannot be delivered before it is fully paid.",
    fr: "Une commande ne peut être livrée avant son paiement intégral.",
    "zh-CN": "订单全额收款后才能交付。",
  },
  "Order cannot be delivered until every linked service ticket has been picked up.": {
    en: "Order cannot be delivered until every linked service ticket has been picked up.",
    fr: "Une commande ne peut être livrée tant que tous les bons liés n'ont pas été retirés.",
    "zh-CN": "所有关联工单都取件后，订单才能交付。",
  },
  "Order has been modified. Refresh and try again.": {
    en: "Order has been modified. Refresh and try again.",
    fr: "La commande a été modifiée. Actualisez et réessayez.",
    "zh-CN": "订单已被修改，请刷新后重试。",
  },
  "Order is already fully paid.": {
    en: "Order is already fully paid.",
    fr: "La commande est déjà intégralement payée.",
    "zh-CN": "订单已全额收款。",
  },
  "Order item has been modified. Refresh and try again.": {
    en: "Order item has been modified. Refresh and try again.",
    fr: "La ligne de commande a été modifiée. Actualisez et réessayez.",
    "zh-CN": "订单项目已被修改，请刷新后重试。",
  },
  "Order item was not found.": {
    en: "Order item was not found.",
    fr: "Ligne de commande introuvable.",
    "zh-CN": "未找到订单项目。",
  },
  "Order not found.": {
    en: "Order not found.",
    fr: "Commande introuvable.",
    "zh-CN": "未找到订单。",
  },
  "Order was not found.": {
    en: "Order was not found.",
    fr: "Commande introuvable.",
    "zh-CN": "未找到订单。",
  },
  "Orders cannot transition back to draft.": {
    en: "Orders cannot transition back to draft.",
    fr: "Une commande ne peut pas revenir à l'état brouillon.",
    "zh-CN": "订单不能退回草稿状态。",
  },
  "Paid orders cannot be cancelled.": {
    en: "Paid orders cannot be cancelled.",
    fr: "Une commande payée ne peut pas être annulée.",
    "zh-CN": "已收款的订单不能取消。",
  },
  "Paid orders cannot be edited.": {
    en: "Paid orders cannot be edited.",
    fr: "Une commande payée ne peut pas être modifiée.",
    "zh-CN": "已收款的订单不能编辑。",
  },
  "Paid status is controlled by payment transactions unless a fully discounted zero-total order is being confirmed.": {
    en: "Paid status is controlled by payment transactions unless a fully discounted zero-total order is being confirmed.",
    fr: "L'état payé est régi par les transactions de paiement, sauf pour une commande à total nul entièrement remisée.",
    "zh-CN": "收款状态由支付流水决定；仅当订单被全额优惠为零时可直接确认。",
  },
  "Park or clear the current cart before claiming another cart.": {
    en: "Park or clear the current cart before claiming another cart.",
    fr: "Mettez en attente ou videz le panier en cours avant d'en reprendre un autre.",
    "zh-CN": "取回其他挂单前，请先挂起或清空当前购物车。",
  },
  "Payment adjustment could not be created.": {
    en: "Payment adjustment could not be created.",
    fr: "L'ajustement de paiement n'a pas pu être créé.",
    "zh-CN": "无法创建收款调整记录。",
  },
  "Payment amount exceeds the current outstanding balance.": {
    en: "Payment amount exceeds the current outstanding balance.",
    fr: "Le montant du paiement dépasse le solde restant dû.",
    "zh-CN": "收款金额超过当前待收余额。",
  },
  "Payment amount exceeds the outstanding balance.": {
    en: "Payment amount exceeds the outstanding balance.",
    fr: "Le montant du paiement dépasse le solde restant dû.",
    "zh-CN": "收款金额超过待收余额。",
  },
  "Payment transaction was not found.": {
    en: "Payment transaction was not found.",
    fr: "Transaction de paiement introuvable.",
    "zh-CN": "未找到支付流水。",
  },
  "Payment was not found.": {
    en: "Payment was not found.",
    fr: "Paiement introuvable.",
    "zh-CN": "未找到收款记录。",
  },
  "Printer configuration was modified. Refresh and try again.": {
    en: "Printer configuration was modified. Refresh and try again.",
    fr: "La configuration de l'imprimante a été modifiée. Actualisez et réessayez.",
    "zh-CN": "打印机配置已被修改，请刷新后重试。",
  },
  "Receipt delivery was not found.": {
    en: "Receipt delivery was not found.",
    fr: "Envoi de reçu introuvable.",
    "zh-CN": "未找到小票投递记录。",
  },
  "Refresh token has expired.": {
    en: "Refresh token has expired.",
    fr: "Le jeton de rafraîchissement a expiré.",
    "zh-CN": "刷新令牌已过期。",
  },
  "Refresh token is invalid.": {
    en: "Refresh token is invalid.",
    fr: "Le jeton de rafraîchissement n'est pas valide.",
    "zh-CN": "刷新令牌无效。",
  },
  "Refresh token reuse detected.": {
    en: "Refresh token reuse detected.",
    fr: "Réutilisation du jeton de rafraîchissement détectée.",
    "zh-CN": "检测到刷新令牌被重复使用。",
  },
  "Refresh token tenant no longer matches the user account.": {
    en: "Refresh token tenant no longer matches the user account.",
    fr: "Le locataire du jeton de rafraîchissement ne correspond plus au compte utilisateur.",
    "zh-CN": "刷新令牌的租户与该用户账号已不匹配。",
  },
  "Refresh token user is invalid.": {
    en: "Refresh token user is invalid.",
    fr: "L'utilisateur du jeton de rafraîchissement n'est pas valide.",
    "zh-CN": "刷新令牌对应的用户无效。",
  },
  "Refund amount exceeds the order's current paid amount.": {
    en: "Refund amount exceeds the order's current paid amount.",
    fr: "Le montant du remboursement dépasse le montant actuellement payé.",
    "zh-CN": "退款金额超过订单当前已收金额。",
  },
  "Refund amount exceeds the remaining refundable amount.": {
    en: "Refund amount exceeds the remaining refundable amount.",
    fr: "Le montant du remboursement dépasse le montant remboursable restant.",
    "zh-CN": "退款金额超过剩余可退金额。",
  },
  "Refund status changed; refresh and try again.": {
    en: "Refund status changed; refresh and try again.",
    fr: "L'état du remboursement a changé ; actualisez et réessayez.",
    "zh-CN": "退款状态已变化，请刷新后重试。",
  },
  "Refund was not found.": {
    en: "Refund was not found.",
    fr: "Remboursement introuvable.",
    "zh-CN": "未找到退款记录。",
  },
  "Resolve the pending Wave or Orange Money payment before changing order pricing.": {
    en: "Resolve the pending Wave or Orange Money payment before changing order pricing.",
    fr: "Validez le paiement Wave ou Orange Money en attente avant de modifier le prix de la commande.",
    "zh-CN": "修改订单价格前，请先处理待确认的 Wave 或 Orange Money 收款。",
  },
  "Resolve the pending mobile or card payment before recording another external payment.": {
    en: "Resolve the pending mobile or card payment before recording another external payment.",
    fr: "Validez le paiement mobile ou carte en attente avant d'enregistrer un autre paiement externe.",
    "zh-CN": "记录其他外部收款前，请先处理待确认的移动支付或刷卡收款。",
  },
  "Select an item type before choosing a service.": {
    en: "Select an item type before choosing a service.",
    fr: "Choisissez un type d'article avant de sélectionner un service.",
    "zh-CN": "请先选择物品类型，再选择服务。",
  },
  "Service ticket has been modified. Refresh and try again.": {
    en: "Service ticket has been modified. Refresh and try again.",
    fr: "Le bon de service a été modifié. Actualisez et réessayez.",
    "zh-CN": "服务工单已被修改，请刷新后重试。",
  },
  "Service ticket item was not found.": {
    en: "Service ticket item was not found.",
    fr: "Article de bon de service introuvable.",
    "zh-CN": "未找到服务工单项目。",
  },
  "Service ticket was not found.": {
    en: "Service ticket was not found.",
    fr: "Bon de service introuvable.",
    "zh-CN": "未找到服务工单。",
  },
  "Staff member was not found in this branch.": {
    en: "Staff member was not found in this branch.",
    fr: "Employé introuvable dans ce magasin.",
    "zh-CN": "该门店未找到此员工。",
  },
  "Tenant is not active.": {
    en: "Tenant is not active.",
    fr: "Le locataire n'est pas actif.",
    "zh-CN": "该租户未启用。",
  },
  "Tendered cash is less than the payment amount.": {
    en: "Tendered cash is less than the payment amount.",
    fr: "Les espèces reçues sont inférieures au montant à payer.",
    "zh-CN": "实收现金少于应收金额。",
  },
  "Terminal settings already exist for this device. Use PATCH to update.": {
    en: "Terminal settings already exist for this device. Use PATCH to update.",
    fr: "Des réglages existent déjà pour cet appareil. Utilisez PATCH pour les modifier.",
    "zh-CN": "该设备已存在终端设置，请使用 PATCH 修改。",
  },
  "Terminal settings were modified by another request. Please refresh and try again.": {
    en: "Terminal settings were modified by another request. Please refresh and try again.",
    fr: "Les réglages de la caisse ont été modifiés par une autre requête. Actualisez et réessayez.",
    "zh-CN": "终端设置已被其他请求修改，请刷新后重试。",
  },
  "The POS terminal changed while signing in. Try again.": {
    en: "The POS terminal changed while signing in. Try again.",
    fr: "La caisse a changé pendant la connexion. Réessayez.",
    "zh-CN": "登录过程中终端发生变化，请重试。",
  },
  "The POS terminal credential changed. Sign in with a staff PIN again.": {
    en: "The POS terminal credential changed. Sign in with a staff PIN again.",
    fr: "Les identifiants de la caisse ont changé. Reconnectez-vous avec un PIN employé.",
    "zh-CN": "终端凭证已变更，请重新使用员工 PIN 登录。",
  },
  "The POS terminal is not enrolled.": {
    en: "The POS terminal is not enrolled.",
    fr: "La caisse n'est pas enregistrée.",
    "zh-CN": "该 POS 终端尚未绑定。",
  },
  "The POS terminal session is no longer active.": {
    en: "The POS terminal session is no longer active.",
    fr: "La session de la caisse n'est plus active.",
    "zh-CN": "该 POS 终端会话已失效。",
  },
  "The TPE payment already has a final outcome.": {
    en: "The TPE payment already has a final outcome.",
    fr: "Le paiement TPE a déjà un résultat définitif.",
    "zh-CN": "该 TPE 收款已有最终结果。",
  },
  "The TPE payment was already resolved.": {
    en: "The TPE payment was already resolved.",
    fr: "Le paiement TPE a déjà été validé.",
    "zh-CN": "该 TPE 收款已处理完成。",
  },
  "The active POS branch was not found.": {
    en: "The active POS branch was not found.",
    fr: "Le magasin POS actif est introuvable.",
    "zh-CN": "未找到当前 POS 门店。",
  },
  "The active cart changed before it could be parked.": {
    en: "The active cart changed before it could be parked.",
    fr: "Le panier actif a changé avant d'avoir pu être mis en attente.",
    "zh-CN": "当前购物车在挂单前已发生变化。",
  },
  "The active hardware device was not found for this POS terminal.": {
    en: "The active hardware device was not found for this POS terminal.",
    fr: "Aucun matériel actif n'a été trouvé pour cette caisse.",
    "zh-CN": "未找到该 POS 终端的有效硬件设备。",
  },
  "The cart branch does not match the enrolled terminal.": {
    en: "The cart branch does not match the enrolled terminal.",
    fr: "Le magasin du panier ne correspond pas à la caisse enregistrée.",
    "zh-CN": "购物车门店与已绑定终端不一致。",
  },
  "The cart currency does not match the terminal branch currency.": {
    en: "The cart currency does not match the terminal branch currency.",
    fr: "La devise du panier ne correspond pas à celle du magasin de la caisse.",
    "zh-CN": "购物车币种与终端门店币种不一致。",
  },
  "The cart update timestamp is invalid or too far in the future.": {
    en: "The cart update timestamp is invalid or too far in the future.",
    fr: "L'horodatage de mise à jour du panier est invalide ou trop loin dans le futur.",
    "zh-CN": "购物车更新时间无效或超前过多。",
  },
  "The cash movement idempotency key is already used by another operation.": {
    en: "The cash movement idempotency key is already used by another operation.",
    fr: "La clé d'idempotence du mouvement d'espèces est déjà utilisée par une autre opération.",
    "zh-CN": "该现金流水幂等键已被其他操作占用。",
  },
  "The cash payment occurrence time is invalid.": {
    en: "The cash payment occurrence time is invalid.",
    fr: "L'heure de l'encaissement en espèces est invalide.",
    "zh-CN": "现金收款的发生时间无效。",
  },
  "The combined tender amount exceeds the order total.": {
    en: "The combined tender amount exceeds the order total.",
    fr: "Le montant total reçu dépasse le total de la commande.",
    "zh-CN": "合计收款金额超过订单总额。",
  },
  "The customer profile id is already used by another account.": {
    en: "The customer profile id is already used by another account.",
    fr: "L'identifiant de fiche client est déjà utilisé par un autre compte.",
    "zh-CN": "该客户档案 ID 已被其他账户占用。",
  },
  "The default payment method must also be enabled for this terminal.": {
    en: "The default payment method must also be enabled for this terminal.",
    fr: "Le moyen de paiement par défaut doit aussi être activé sur cette caisse.",
    "zh-CN": "默认支付方式也必须在此终端上启用。",
  },
  "The discount code was not found or is not active for this cart.": {
    en: "The discount code was not found or is not active for this cart.",
    fr: "Le code de remise est introuvable ou inactif pour ce panier.",
    "zh-CN": "未找到该优惠码，或其对本购物车无效。",
  },
  "The discount is no longer eligible for this order.": {
    en: "The discount is no longer eligible for this order.",
    fr: "La remise n'est plus applicable à cette commande.",
    "zh-CN": "该优惠已不适用于此订单。",
  },
  "The discount was not found or is not active for this order.": {
    en: "The discount was not found or is not active for this order.",
    fr: "La remise est introuvable ou inactive pour cette commande.",
    "zh-CN": "未找到该优惠，或其对本订单无效。",
  },
  "The exception report does not belong to this register's cash session.": {
    en: "The exception report does not belong to this register's cash session.",
    fr: "Le signalement d'incident n'appartient pas à la session de caisse de ce poste.",
    "zh-CN": "该异常上报不属于本收银台的现金会话。",
  },
  "The exception report does not belong to this terminal's register session.": {
    en: "The exception report does not belong to this terminal's register session.",
    fr: "Le signalement d'incident n'appartient pas à la session de caisse de cette caisse.",
    "zh-CN": "该异常上报不属于本终端的收银台会话。",
  },
  "The idempotency key is already used by another adjustment.": {
    en: "The idempotency key is already used by another adjustment.",
    fr: "La clé d'idempotence est déjà utilisée par un autre ajustement.",
    "zh-CN": "该幂等键已被其他调整操作占用。",
  },
  "The idempotency key is already used by another discount operation.": {
    en: "The idempotency key is already used by another discount operation.",
    fr: "La clé d'idempotence est déjà utilisée par une autre opération de remise.",
    "zh-CN": "该幂等键已被其他优惠操作占用。",
  },
  "The idempotency key or provider reference is already used by another payment.": {
    en: "The idempotency key or provider reference is already used by another payment.",
    fr: "La clé d'idempotence ou la référence du prestataire est déjà utilisée par un autre paiement.",
    "zh-CN": "该幂等键或支付机构参考号已被其他收款占用。",
  },
  "The offline checkout does not belong to this terminal branch.": {
    en: "The offline checkout does not belong to this terminal branch.",
    fr: "L'encaissement hors ligne n'appartient pas au magasin de cette caisse.",
    "zh-CN": "该离线结款不属于本终端所在门店。",
  },
  "The offline command identity does not match the exception report.": {
    en: "The offline command identity does not match the exception report.",
    fr: "L'identité de l'opération hors ligne ne correspond pas au signalement d'incident.",
    "zh-CN": "离线操作标识与异常上报不匹配。",
  },
  "The open work shift belongs to another branch.": {
    en: "The open work shift belongs to another branch.",
    fr: "Le service ouvert appartient à un autre magasin.",
    "zh-CN": "已开始的班次属于其他门店。",
  },
  "The order discount application was not found.": {
    en: "The order discount application was not found.",
    fr: "L'application de remise sur la commande est introuvable.",
    "zh-CN": "未找到该订单的优惠使用记录。",
  },
  "The order no longer has enough refundable payment balance.": {
    en: "The order no longer has enough refundable payment balance.",
    fr: "La commande n'a plus assez de solde remboursable.",
    "zh-CN": "该订单可退余额已不足。",
  },
  "The original paid transaction is not available for adjustment.": {
    en: "The original paid transaction is not available for adjustment.",
    fr: "La transaction payée d'origine n'est pas disponible pour un ajustement.",
    "zh-CN": "原始已付流水不可用于调整。",
  },
  "The original payment is not available.": {
    en: "The original payment is not available.",
    fr: "Le paiement d'origine n'est pas disponible.",
    "zh-CN": "原始收款记录不可用。",
  },
  "The parked cart was claimed by another operator.": {
    en: "The parked cart was claimed by another operator.",
    fr: "Le panier en attente a été repris par un autre opérateur.",
    "zh-CN": "该挂单已被其他操作员取回。",
  },
  "The parked cart was not found or has expired.": {
    en: "The parked cart was not found or has expired.",
    fr: "Le panier en attente est introuvable ou a expiré.",
    "zh-CN": "未找到该挂单，或其已过期。",
  },
  "The payment could not be created because its reference is already in use.": {
    en: "The payment could not be created because its reference is already in use.",
    fr: "Le paiement n'a pas pu être créé car sa référence est déjà utilisée.",
    "zh-CN": "该收款的参考号已被占用，无法创建。",
  },
  "The recovered cash payment could not be verified.": {
    en: "The recovered cash payment could not be verified.",
    fr: "Le paiement en espèces repris n'a pas pu être vérifié.",
    "zh-CN": "补传的现金收款无法通过校验。",
  },
  "The register changed while it was being closed.": {
    en: "The register changed while it was being closed.",
    fr: "La caisse a changé pendant sa fermeture.",
    "zh-CN": "关闭过程中收银台状态发生变化。",
  },
  "The register changed while it was being opened.": {
    en: "The register changed while it was being opened.",
    fr: "La caisse a changé pendant son ouverture.",
    "zh-CN": "开启过程中收银台状态发生变化。",
  },
  "The requested cash session is not open for this register.": {
    en: "The requested cash session is not open for this register.",
    fr: "La session de caisse demandée n'est pas ouverte pour ce poste.",
    "zh-CN": "所请求的现金会话在本收银台未开启。",
  },
  "The requested cash session was not found.": {
    en: "The requested cash session was not found.",
    fr: "Session de caisse demandée introuvable.",
    "zh-CN": "未找到所请求的现金会话。",
  },
  "The requested register session is not open on this terminal.": {
    en: "The requested register session is not open on this terminal.",
    fr: "La session de caisse demandée n'est pas ouverte sur cette caisse.",
    "zh-CN": "所请求的收银台会话在本终端未开启。",
  },
  "The requested register session was not found.": {
    en: "The requested register session was not found.",
    fr: "Session de caisse demandée introuvable.",
    "zh-CN": "未找到所请求的收银台会话。",
  },
  "The return idempotency key is already used by another order.": {
    en: "The return idempotency key is already used by another order.",
    fr: "La clé d'idempotence du retour est déjà utilisée par une autre commande.",
    "zh-CN": "该退货幂等键已被其他订单占用。",
  },
  "The selected catalog service is not active or has no active price.": {
    en: "The selected catalog service is not active or has no active price.",
    fr: "Le service du catalogue sélectionné est inactif ou n'a pas de tarif actif.",
    "zh-CN": "所选目录服务未启用，或没有有效价格。",
  },
  "The selected customer is not active.": {
    en: "The selected customer is not active.",
    fr: "Le client sélectionné n'est pas actif.",
    "zh-CN": "所选客户未启用。",
  },
  "The selected product has no inventory balance at this branch.": {
    en: "The selected product has no inventory balance at this branch.",
    fr: "Le produit sélectionné n'a aucun stock dans ce magasin.",
    "zh-CN": "所选商品在本门店没有库存余额。",
  },
  "The selected product is not available at this branch or has no active price.": {
    en: "The selected product is not available at this branch or has no active price.",
    fr: "Le produit sélectionné n'est pas disponible dans ce magasin ou n'a pas de tarif actif.",
    "zh-CN": "所选商品在本门店不可用，或没有有效价格。",
  },
  "The selected product price currency does not match the order currency.": {
    en: "The selected product price currency does not match the order currency.",
    fr: "La devise du prix du produit ne correspond pas à celle de la commande.",
    "zh-CN": "所选商品价格的币种与订单币种不一致。",
  },
  "The selected service does not apply to this item type.": {
    en: "The selected service does not apply to this item type.",
    fr: "Le service sélectionné ne s'applique pas à ce type d'article.",
    "zh-CN": "所选服务不适用于该物品类型。",
  },
  "The selected service does not belong to this ticket business line.": {
    en: "The selected service does not belong to this ticket business line.",
    fr: "Le service sélectionné n'appartient pas à la ligne d'activité de ce bon.",
    "zh-CN": "所选服务不属于该工单的业务线。",
  },
  "The selected service price currency does not match the order currency.": {
    en: "The selected service price currency does not match the order currency.",
    fr: "La devise du prix du service ne correspond pas à celle de la commande.",
    "zh-CN": "所选服务价格的币种与订单币种不一致。",
  },
  "The selected service price currency does not match the ticket currency.": {
    en: "The selected service price currency does not match the ticket currency.",
    fr: "La devise du prix du service ne correspond pas à celle du bon.",
    "zh-CN": "所选服务价格的币种与工单币种不一致。",
  },
  "The selected service ticket was not found at this branch.": {
    en: "The selected service ticket was not found at this branch.",
    fr: "Le bon de service sélectionné est introuvable dans ce magasin.",
    "zh-CN": "该门店未找到所选服务工单。",
  },
  "The selected ticket item was not found.": {
    en: "The selected ticket item was not found.",
    fr: "L'article de bon sélectionné est introuvable.",
    "zh-CN": "未找到所选工单项目。",
  },
  "The staff member is not assigned to the terminal branch.": {
    en: "The staff member is not assigned to the terminal branch.",
    fr: "L'employé n'est pas affecté au magasin de cette caisse.",
    "zh-CN": "该员工未被分配到终端所在门店。",
  },
  "The successful card amount exceeds the outstanding balance.": {
    en: "The successful card amount exceeds the outstanding balance.",
    fr: "Le montant de la carte acceptée dépasse le solde restant dû.",
    "zh-CN": "刷卡成功金额超过待收余额。",
  },
  "The terminal branch does not exist or is inactive.": {
    en: "The terminal branch does not exist or is inactive.",
    fr: "Le magasin de la caisse n'existe pas ou est inactif.",
    "zh-CN": "终端所属门店不存在或已停用。",
  },
  "The terminal branch is not active.": {
    en: "The terminal branch is not active.",
    fr: "Le magasin de la caisse n'est pas actif.",
    "zh-CN": "终端所属门店未启用。",
  },
  "The terminal branch was not found.": {
    en: "The terminal branch was not found.",
    fr: "Magasin de la caisse introuvable.",
    "zh-CN": "未找到终端所属门店。",
  },
  "The terminal changed during this request. Refresh and try again.": {
    en: "The terminal changed during this request. Refresh and try again.",
    fr: "La caisse a changé pendant cette requête. Actualisez et réessayez.",
    "zh-CN": "本次请求期间终端发生变化，请刷新后重试。",
  },
  "The terminal credential was revoked. Enroll this device again before enabling it.": {
    en: "The terminal credential was revoked. Enroll this device again before enabling it.",
    fr: "Les identifiants de la caisse ont été révoqués. Réenregistrez cet appareil avant de l'activer.",
    "zh-CN": "终端凭证已被撤销，请重新绑定本设备后再启用。",
  },
  "The terminal is already enrolled. Rotate its credential instead.": {
    en: "The terminal is already enrolled. Rotate its credential instead.",
    fr: "La caisse est déjà enregistrée. Renouvelez plutôt ses identifiants.",
    "zh-CN": "该终端已绑定，请改为轮换其凭证。",
  },
  "The ticket currency does not match the branch currency.": {
    en: "The ticket currency does not match the branch currency.",
    fr: "La devise du bon ne correspond pas à celle du magasin.",
    "zh-CN": "工单币种与门店币种不一致。",
  },
  "This POS terminal credential is invalid or expired.": {
    en: "This POS terminal credential is invalid or expired.",
    fr: "Les identifiants de cette caisse sont invalides ou expirés.",
    "zh-CN": "该 POS 终端凭证无效或已过期。",
  },
  "This POS terminal is disabled.": {
    en: "This POS terminal is disabled.",
    fr: "Cette caisse est désactivée.",
    "zh-CN": "该 POS 终端已停用。",
  },
  "This POS terminal must be enrolled before PIN login.": {
    en: "This POS terminal must be enrolled before PIN login.",
    fr: "Cette caisse doit être enregistrée avant une connexion par PIN.",
    "zh-CN": "使用 PIN 登录前必须先绑定该 POS 终端。",
  },
  "This discount cannot be combined with an existing order discount.": {
    en: "This discount cannot be combined with an existing order discount.",
    fr: "Cette remise ne peut pas être cumulée avec une remise existante.",
    "zh-CN": "该优惠不能与订单上已有的优惠叠加。",
  },
  "This discount code does not meet the cart requirements.": {
    en: "This discount code does not meet the cart requirements.",
    fr: "Ce code de remise ne remplit pas les conditions du panier.",
    "zh-CN": "该优惠码不满足购物车的使用条件。",
  },
  "This discount does not meet the order requirements.": {
    en: "This discount does not meet the order requirements.",
    fr: "Cette remise ne remplit pas les conditions de la commande.",
    "zh-CN": "该优惠不满足订单的使用条件。",
  },
  "This exception belongs to another operator.": {
    en: "This exception belongs to another operator.",
    fr: "Cet incident appartient à un autre opérateur.",
    "zh-CN": "该异常记录属于其他操作员。",
  },
  "This failed refund can no longer be completed because the payment's refundable balance was used by another refund.": {
    en: "This failed refund can no longer be completed because the payment's refundable balance was used by another refund.",
    fr: "Ce remboursement en échec ne peut plus aboutir : le solde remboursable a été utilisé par un autre remboursement.",
    "zh-CN": "该失败退款已无法完成：可退余额已被其他退款占用。",
  },
  "This item is already billed on an order. Refund or amend that order instead of removing the item.": {
    en: "This item is already billed on an order. Refund or amend that order instead of removing the item.",
    fr: "Cet article est déjà facturé sur une commande. Remboursez ou modifiez cette commande au lieu de le retirer.",
    "zh-CN": "该项目已在订单中结算。请退款或修改该订单，而不是移除项目。",
  },
  "This offline cash exception belongs to another operator.": {
    en: "This offline cash exception belongs to another operator.",
    fr: "Cet incident de caisse hors ligne appartient à un autre opérateur.",
    "zh-CN": "该离线现金异常属于其他操作员。",
  },
  "This payment has already been resolved.": {
    en: "This payment has already been resolved.",
    fr: "Ce paiement a déjà été validé.",
    "zh-CN": "该收款已处理完成。",
  },
  "This personal cash session has already been closed.": {
    en: "This personal cash session has already been closed.",
    fr: "Cette session de fonds personnel est déjà clôturée.",
    "zh-CN": "该随身现金会话已关闭。",
  },
  "This physical printer is already assigned to another print purpose on this terminal.": {
    en: "This physical printer is already assigned to another print purpose on this terminal.",
    fr: "Cette imprimante physique est déjà affectée à un autre usage sur cette caisse.",
    "zh-CN": "该物理打印机已在本终端分配给其他打印用途。",
  },
  "This register session has already been closed.": {
    en: "This register session has already been closed.",
    fr: "Cette session de caisse est déjà clôturée.",
    "zh-CN": "该收银台会话已关闭。",
  },
  "This staff member already has an open shift.": {
    en: "This staff member already has an open shift.",
    fr: "Cet employé a déjà un service ouvert.",
    "zh-CN": "该员工已有进行中的班次。",
  },
  "This staff member already has an open work shift.": {
    en: "This staff member already has an open work shift.",
    fr: "Cet employé a déjà un service de travail ouvert.",
    "zh-CN": "该员工已有进行中的工作班次。",
  },
  "This ticket has already been paid. Refund the linked order before cancelling it.": {
    en: "This ticket has already been paid. Refund the linked order before cancelling it.",
    fr: "Ce bon a déjà été payé. Remboursez la commande liée avant de l'annuler.",
    "zh-CN": "该工单已收款。取消前请先对关联订单退款。",
  },
  "Ticket cannot be picked up until all linked orders are paid.": {
    en: "Ticket cannot be picked up until all linked orders are paid.",
    fr: "Le bon ne peut être retiré tant que toutes les commandes liées ne sont pas payées.",
    "zh-CN": "所有关联订单收款后，工单才能取件。",
  },
  "Ticket item pricing inputs must be decimal numbers.": {
    en: "Ticket item pricing inputs must be decimal numbers.",
    fr: "Les données de tarification de l'article doivent être des nombres décimaux.",
    "zh-CN": "工单项目的计价输入必须是十进制数字。",
  },
  "Too many failed login attempts. Try again later.": {
    en: "Too many failed login attempts. Try again later.",
    fr: "Trop de tentatives de connexion échouées. Réessayez plus tard.",
    "zh-CN": "登录尝试过多，请稍后再试。",
  },
  "User cannot access POS resources.": {
    en: "User cannot access POS resources.",
    fr: "Cet utilisateur ne peut pas accéder aux ressources POS.",
    "zh-CN": "该用户无权访问 POS 资源。",
  },
  "User cannot access SaaS resources.": {
    en: "User cannot access SaaS resources.",
    fr: "Cet utilisateur ne peut pas accéder aux ressources SaaS.",
    "zh-CN": "该用户无权访问 SaaS 资源。",
  },
  "User cannot access tenant resources.": {
    en: "User cannot access tenant resources.",
    fr: "Cet utilisateur ne peut pas accéder aux ressources du locataire.",
    "zh-CN": "该用户无权访问租户资源。",
  },
  "User does not have enough permission.": {
    en: "User does not have enough permission.",
    fr: "Cet utilisateur n'a pas les droits suffisants.",
    "zh-CN": "该用户权限不足。",
  },
  "User is disabled.": {
    en: "User is disabled.",
    fr: "Cet utilisateur est désactivé.",
    "zh-CN": "该用户已停用。",
  },
  "User is not assigned to this branch.": {
    en: "User is not assigned to this branch.",
    fr: "Cet utilisateur n'est pas affecté à ce magasin.",
    "zh-CN": "该用户未被分配到本门店。",
  },
  "User is suspended.": {
    en: "User is suspended.",
    fr: "Cet utilisateur est suspendu.",
    "zh-CN": "该用户已被暂停。",
  },
  "Weight is required for a per-kilogram service.": {
    en: "Weight is required for a per-kilogram service.",
    fr: "Le poids est obligatoire pour un service au kilogramme.",
    "zh-CN": "按公斤计费的服务必须填写重量。",
  },
  "Z Report was not found in this branch.": {
    en: "Z Report was not found in this branch.",
    fr: "Rapport Z introuvable dans ce magasin.",
    "zh-CN": "该门店未找到 Z Report。",
  },
};

/**
 * Translate an API error message, falling back to the message as written.
 *
 * The fallback is deliberate: an untranslated message is worse than English
 * only slightly, while a thrown error or an empty string during a sale is
 * worse than both.
 */
export function localizeErrorMessage(
  message: string,
  locale: SupportedLocale,
): string {
  return POS_ERROR_MESSAGES[message]?.[locale] ?? message;
}

/** Every English message carrying a translation; the smoke test reads this. */
export function listLocalizedErrorMessages(): readonly string[] {
  return Object.keys(POS_ERROR_MESSAGES);
}
