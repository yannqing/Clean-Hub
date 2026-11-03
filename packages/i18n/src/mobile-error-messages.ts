import type { SupportedLocale } from "./locales.js";

export const mobileErrorMessages: Readonly<
  Record<string, Readonly<Record<SupportedLocale, string>>>
> = {
  "Pickup and delivery are not enabled for this tenant.": {
    en: "Pickup and delivery are not enabled for this tenant.",
    fr: "La collecte et la livraison ne sont pas activées pour ce locataire.",
    "zh-CN": "此商家未开通取送服务，请联系门店。",
  },
  "One-time-code delivery is unavailable. Ask the store to issue an app password.":
    {
      en: "One-time-code delivery is unavailable. Ask the store to issue an app password.",
      fr: "L’envoi de codes est indisponible. Demandez un mot de passe d’application au magasin.",
      "zh-CN": "暂时无法发送验证码，请联系门店开通或重置 App 登录密码。",
    },
  "The sign-in code could not be sent. Please try again later or contact the store.":
    {
      en: "The sign-in code could not be sent. Please try again later or contact the store.",
      fr: "Le code n’a pas pu être envoyé. Réessayez plus tard ou contactez le magasin.",
      "zh-CN": "登录验证码发送失败，请稍后重试或联系门店。",
    },
  "Please wait one minute before requesting another sign-in code.": {
    en: "Please wait one minute before requesting another sign-in code.",
    fr: "Veuillez patienter une minute avant de demander un autre code de connexion.",
    "zh-CN": "验证码请求过于频繁，请等待一分钟后再试。",
  },
  "The delivery work order does not belong to this customer and store.": {
    en: "The delivery work order does not belong to this customer and store.",
    fr: "Le bon de service à livrer n’appartient pas à ce client et à ce magasin.",
    "zh-CN": "配送工单与当前客户或门店不符，请重新选择。",
  },
  "The delivery order does not belong to this customer and store.": {
    en: "The delivery order does not belong to this customer and store.",
    fr: "La commande à livrer n’appartient pas à ce client et à ce magasin.",
    "zh-CN": "配送订单与当前客户或门店不符，请重新选择。",
  },
  "The delivery order does not match the work order.": {
    en: "The delivery order does not match the work order.",
    fr: "La commande à livrer ne correspond pas au bon de service.",
    "zh-CN": "配送订单与所选工单不对应，请重新选择。",
  },
  "Select the work order or order to be delivered.": {
    en: "Select the work order or order to be delivered.",
    fr: "Sélectionnez le bon de service ou la commande à livrer.",
    "zh-CN": "请选择需要送回的工单或订单。",
  },
  "The work order is not ready for delivery.": {
    en: "The work order is not ready for delivery.",
    fr: "Le bon de service n’est pas prêt à être livré.",
    "zh-CN": "工单尚未就绪，或已完成交付，暂不能安排送回。",
  },
  "Settle all linked orders before requesting delivery.": {
    en: "Settle all linked orders before requesting delivery.",
    fr: "Réglez toutes les commandes liées avant de demander une livraison.",
    "zh-CN": "请先完成工单全部项目的计费并结清相关订单，再申请送回。",
  },
  "Complete the pickup before receiving items at the store.": {
    en: "Complete the pickup before receiving items at the store.",
    fr: "Terminez la collecte avant de réceptionner les articles au magasin.",
    "zh-CN": "请先完成上门取件，再办理门店收件。",
  },
  "Appointment was not found.": {
    en: "Appointment was not found.",
    fr: "Le rendez-vous est introuvable.",
    "zh-CN": "未找到该预约，请刷新后重试。",
  },
  "Refund request was not found.": {
    en: "Refund request was not found.",
    fr: "La demande de remboursement est introuvable.",
    "zh-CN": "未找到退款申请，请刷新后重试。",
  },
  "Refund amount cannot be settled in this currency.": {
    en: "Refund amount cannot be settled in this currency.",
    fr: "Le montant du remboursement n’est pas compatible avec cette devise.",
    "zh-CN": "退款金额不符合此币种的结算单位，请核对金额。",
  },
  "Refund request no longer matches its order.": {
    en: "Refund request no longer matches its order.",
    fr: "La demande de remboursement ne correspond plus à sa commande.",
    "zh-CN": "退款申请与当前订单信息不一致，请刷新并核对。",
  },
  "Approve this refund before recording its settlement.": {
    en: "Approve this refund before recording its settlement.",
    fr: "Approuvez ce remboursement avant d’enregistrer son règlement.",
    "zh-CN": "请先审批退款申请，再登记实际退款。",
  },
  "Refund amount exceeds the order's current paid amount.": {
    en: "Refund amount exceeds the order's current paid amount.",
    fr: "Le remboursement dépasse le montant actuellement encaissé pour la commande.",
    "zh-CN": "退款金额超过订单当前实收，请核对已退金额。",
  },
  "The refundable balance changed. Review the original payments.": {
    en: "The refundable balance changed. Review the original payments.",
    fr: "Le solde remboursable a changé. Vérifiez les paiements d’origine.",
    "zh-CN": "可退余额已变化，请核对原收款记录。",
  },
  "Confirm that the cash has actually been returned to the customer.": {
    en: "Confirm that the cash has actually been returned to the customer.",
    fr: "Confirmez que les espèces ont bien été rendues au client.",
    "zh-CN": "请确认已实际将现金退还给客户，再登记退款。",
  },
  "A provider settlement reference is required for every non-cash refund.": {
    en: "A provider settlement reference is required for every non-cash refund.",
    fr: "Une référence de remboursement du prestataire est requise pour chaque remboursement hors espèces.",
    "zh-CN": "每笔非现金退款都必须填写支付渠道的实际退款凭证号。",
  },
  "Customer access is required.": {
    en: "Customer access is required.",
    fr: "Un compte client est requis.",
    "zh-CN": "请使用客户账号访问此功能。",
  },
  "Owner access is required.": {
    en: "Owner access is required.",
    fr: "Un compte propriétaire est requis.",
    "zh-CN": "请使用店主账号操作此功能。",
  },
  "Customer one-time-code login is disabled for this tenant.": {
    en: "Customer one-time-code login is disabled for this tenant.",
    fr: "La connexion client par code est désactivée pour ce magasin.",
    "zh-CN": "此商家未开通客户验证码登录，请使用密码登录。",
  },
  "Test OTP is disabled.": {
    en: "Test OTP is disabled.",
    fr: "Les codes de test sont désactivés. Utilisez le code reçu par SMS.",
    "zh-CN": "测试验证码已禁用，请使用短信收到的真实验证码。",
  },
  "No active OTP is available.": {
    en: "No active OTP is available.",
    fr: "Aucun code valide n’est disponible. Demandez un nouveau code.",
    "zh-CN": "没有可用的验证码，请重新获取。",
  },
  "Too many failed OTP attempts. Request a new code.": {
    en: "Too many failed OTP attempts. Request a new code.",
    fr: "Trop de tentatives incorrectes. Demandez un nouveau code.",
    "zh-CN": "验证码错误次数过多，请重新获取验证码。",
  },
  "Access token subject is invalid.": {
    en: "Access token subject is invalid.",
    fr: "La session n’est plus valide. Reconnectez-vous.",
    "zh-CN": "登录身份无效，请重新登录。",
  },
  "Refresh token customer is invalid.": {
    en: "Refresh token customer is invalid.",
    fr: "La session client n’est plus valide. Reconnectez-vous.",
    "zh-CN": "客户登录状态已失效，请重新登录。",
  },
  "Mobile staff role is required.": {
    en: "Mobile staff role is required.",
    fr: "Un compte employé autorisé est requis pour cette fonction.",
    "zh-CN": "请使用具有移动端权限的员工账号。",
  },
  "Access token customer is invalid.": {
    en: "Access token customer is invalid.",
    fr: "La session client n’est plus valide. Reconnectez-vous.",
    "zh-CN": "客户身份已失效，请重新登录。",
  },
  "This appointment identifier is already used by another request.": {
    en: "This appointment identifier is already used by another request.",
    fr: "Cet identifiant est déjà utilisé par un autre rendez-vous. Actualisez la liste.",
    "zh-CN": "预约标识已被另一项请求使用，请刷新并检查现有预约。",
  },
  "Select a work order for the return delivery.": {
    en: "Select a work order for the return delivery.",
    fr: "Sélectionnez un bon de service pour la livraison de retour.",
    "zh-CN": "请选择需要送回的工单。",
  },
  "A return delivery is already scheduled for this work order.": {
    en: "A return delivery is already scheduled for this work order.",
    fr: "Une livraison de retour est déjà prévue pour ce bon de service.",
    "zh-CN": "此工单已有送回预约，请查看现有预约，勿重复提交。",
  },
  "Appointment must be scheduled at least 30 minutes in the future.": {
    en: "Appointment must be scheduled at least 30 minutes in the future.",
    fr: "Le rendez-vous doit être prévu au moins 30 minutes à l’avance.",
    "zh-CN": "预约时间需至少晚于当前时间 30 分钟。",
  },
  "A customer profile is required before creating an appointment.": {
    en: "A customer profile is required before creating an appointment.",
    fr: "Ajoutez un contact client avant de créer un rendez-vous.",
    "zh-CN": "请先添加客户联系人，再创建预约。",
  },
  "Latitude must be between -90 and 90.": {
    en: "Latitude must be between -90 and 90.",
    fr: "La latitude doit être comprise entre -90 et 90.",
    "zh-CN": "纬度必须在 -90 至 90 之间。",
  },
  "Longitude must be between -180 and 180.": {
    en: "Longitude must be between -180 and 180.",
    fr: "La longitude doit être comprise entre -180 et 180.",
    "zh-CN": "经度必须在 -180 至 180 之间。",
  },
  "Select a valid country for this address.": {
    en: "Select a valid country for this address.",
    fr: "Sélectionnez un pays valide pour cette adresse.",
    "zh-CN": "请为此地址选择有效的国家。",
  },
  "Branch does not exist in this tenant.": {
    en: "Branch does not exist in this tenant.",
    fr: "Ce magasin n’existe pas chez ce commerçant.",
    "zh-CN": "该门店不属于当前商家，请重新选择。",
  },
  "An active branch is required before creating an appointment.": {
    en: "An active branch is required before creating an appointment.",
    fr: "Un magasin actif est requis pour créer un rendez-vous.",
    "zh-CN": "暂无可接受预约的营业门店，请联系商家。",
  },
  "Customer address was not found.": {
    en: "Customer address was not found.",
    fr: "L’adresse client est introuvable. Actualisez la liste.",
    "zh-CN": "未找到客户地址，请刷新后重试。",
  },
  "Customer contact was not found.": {
    en: "Customer contact was not found.",
    fr: "Le contact client est introuvable. Actualisez la liste.",
    "zh-CN": "未找到客户联系人，请刷新后重试。",
  },
  "Only pending appointments can be cancelled.": {
    en: "Only pending appointments can be cancelled.",
    fr: "Seuls les rendez-vous en attente peuvent être annulés. Contactez le magasin pour les autres.",
    "zh-CN": "仅待确认的预约可自行取消，其他状态请联系门店。",
  },
  "Appointment status changed while processing the cancellation.": {
    en: "Appointment status changed while processing the cancellation.",
    fr: "Le statut du rendez-vous a changé. Actualisez la liste avant de réessayer.",
    "zh-CN": "取消时预约状态已变化，请刷新后重试。",
  },
  "The delivery customer or store is unavailable.": {
    en: "The delivery customer or store is unavailable.",
    fr: "Le client ou le magasin n’est pas disponible pour cette livraison.",
    "zh-CN": "配送客户或门店不可用，请刷新并核对。",
  },
  "Use the signature endpoint to complete a task.": {
    en: "Use the signature endpoint to complete a task.",
    fr: "Enregistrez la signature du client pour terminer cette mission.",
    "zh-CN": "请通过客户签收完成配送任务。",
  },
  "Delivery access is required.": {
    en: "Delivery access is required.",
    fr: "Un compte livreur autorisé est requis.",
    "zh-CN": "请使用有配送权限的账号。",
  },
  "Delivery task was not found.": {
    en: "Delivery task was not found.",
    fr: "La mission de livraison est introuvable ou n’est plus affectée à votre compte.",
    "zh-CN": "未找到配送任务，或该任务已不再分配给您。",
  },
  "Delivery media object was not found.": {
    en: "Delivery media object was not found.",
    fr: "Le justificatif de livraison est introuvable. Envoyez-le à nouveau.",
    "zh-CN": "未找到配送凭证，请重新上传。",
  },
  "Delivery media object is not accessible.": {
    en: "Delivery media object is not accessible.",
    fr: "Vous n’avez pas accès à ce justificatif de livraison.",
    "zh-CN": "无法访问该配送凭证，请核对上传账号和任务。",
  },
  "Owner mobile access is required.": {
    en: "Owner mobile access is required.",
    fr: "Un compte propriétaire autorisé sur mobile est requis.",
    "zh-CN": "请使用具有移动端店主权限的账号。",
  },
  "Owner summary is not available for the current tenant.": {
    en: "Owner summary is not available for the current tenant.",
    fr: "Le tableau de bord est indisponible pour ce commerçant. Réessayez plus tard.",
    "zh-CN": "当前商家的经营概览暂不可用，请稍后重试。",
  },
  "Accepted appointment delivery task could not be loaded.": {
    en: "Accepted appointment delivery task could not be loaded.",
    fr: "La mission liée au rendez-vous accepté n’a pas pu être chargée. Actualisez la liste.",
    "zh-CN": "预约已接受，但配送任务加载失败，请刷新后查看。",
  },
  "Payment amount must be greater than zero.": {
    en: "Payment amount must be greater than zero.",
    fr: "Le montant du paiement doit être supérieur à zéro.",
    "zh-CN": "收款金额必须大于零。",
  },
  "Payment amount exceeds the order balance.": {
    en: "Payment amount exceeds the order balance.",
    fr: "Le paiement dépasse le solde de la commande.",
    "zh-CN": "收款金额超过订单待付金额，请核对。",
  },
  "Mock payment callbacks are disabled in production.": {
    en: "Mock payment callbacks are disabled in production.",
    fr: "Les confirmations de paiement de test sont désactivées en production.",
    "zh-CN": "生产环境禁止模拟支付回调，请通过 POS 记录真实收款。",
  },
  "Refund amount must be greater than zero.": {
    en: "Refund amount must be greater than zero.",
    fr: "Le montant du remboursement doit être supérieur à zéro.",
    "zh-CN": "退款金额必须大于零。",
  },
  "Refund amount exceeds the refundable balance.": {
    en: "Refund amount exceeds the refundable balance.",
    fr: "Le remboursement dépasse le solde remboursable.",
    "zh-CN": "退款金额超过可退余额，请核对已有退款。",
  },
  "Refund amount exceeds the current paid amount.": {
    en: "Refund amount exceeds the current paid amount.",
    fr: "Le remboursement dépasse le montant actuellement encaissé.",
    "zh-CN": "退款金额超过当前实收金额，请刷新并核对。",
  },
  "Payment access is required.": {
    en: "Payment access is required.",
    fr: "Vous n’avez pas les droits nécessaires pour cette opération de paiement.",
    "zh-CN": "当前账号无权执行此支付操作。",
  },
  "Mock payment simulation is not available.": {
    en: "Mock payment simulation is not available.",
    fr: "La simulation de paiement n’est pas disponible.",
    "zh-CN": "模拟支付不可用，请通过 POS 完成真实收款。",
  },
  "Payment gateway is not configured.": {
    en: "Payment gateway is not configured.",
    fr: "Le prestataire de paiement n’est pas configuré. Contactez le magasin.",
    "zh-CN": "支付渠道尚未配置，请联系门店。",
  },

  "Delivery task status changed while processing the request.": {
    "en": "Delivery task status changed while processing the request.",
    "fr": "Le statut de la mission a changé. Actualisez les données avant de réessayer.",
    "zh-CN": "配送任务状态已变化，请同步后重试。"
  },
  "Delivery task status changed while processing the signature.": {
    "en": "Delivery task status changed while processing the signature.",
    "fr": "Le statut de la mission a changé pendant la signature. Actualisez et vérifiez le résultat.",
    "zh-CN": "签收期间配送状态已变化，请同步并核对签收结果。"
  },
  "Only unassigned pending dispatch tasks can be dispatched.": {
    "en": "Only unassigned pending dispatch tasks can be dispatched.",
    "fr": "Seules les missions en attente et non affectées peuvent être attribuées.",
    "zh-CN": "仅待派单且尚未分配的任务可以派单，请刷新列表。"
  },
  "Only assigned delivery tasks can be reassigned.": {
    "en": "Only assigned delivery tasks can be reassigned.",
    "fr": "Seules les missions déjà affectées peuvent être réattribuées.",
    "zh-CN": "仅已分配的配送任务可以改派。"
  },
  "Terminal delivery tasks cannot be reassigned.": {
    "en": "Terminal delivery tasks cannot be reassigned.",
    "fr": "Les missions terminées ou annulées ne peuvent pas être réattribuées.",
    "zh-CN": "已完成或已取消的配送任务不能改派。"
  },
  "Terminal delivery tasks cannot be cancelled.": {
    "en": "Terminal delivery tasks cannot be cancelled.",
    "fr": "Les missions terminées ou annulées ne peuvent pas être annulées à nouveau.",
    "zh-CN": "已完成或已取消的配送任务不能再次取消。"
  },
  "Delivery task changed while processing the request.": {
    "en": "Delivery task changed while processing the request.",
    "fr": "La mission a changé. Actualisez les données avant de réessayer.",
    "zh-CN": "配送任务已被更新，请同步后重试。"
  },
  "Delivery task is already terminal and cannot be overwritten.": {
    "en": "Delivery task is already terminal and cannot be overwritten.",
    "fr": "Cette mission est terminée ou annulée. Son statut ne peut plus être modifié.",
    "zh-CN": "此配送任务已完成或已取消，不能覆盖最终状态。"
  },
  "Delivery task status transition is not allowed.": {
    "en": "Delivery task status transition is not allowed.",
    "fr": "Ce changement de statut n’est pas autorisé. Actualisez la mission et suivez les étapes proposées.",
    "zh-CN": "当前配送状态不支持此操作，请同步并按允许的步骤处理。"
  },
  "Linked delivery task was not found.": {
    "en": "Linked delivery task was not found.",
    "fr": "La mission de livraison associée est introuvable. Contactez le magasin.",
    "zh-CN": "未找到关联配送任务，请联系门店核查。"
  },
  "Only pending appointments can be accepted.": {
    "en": "Only pending appointments can be accepted.",
    "fr": "Seuls les rendez-vous en attente peuvent être acceptés.",
    "zh-CN": "仅待确认的预约可以接受，请刷新预约状态。"
  },
  "Appointment status changed while processing acceptance.": {
    "en": "Appointment status changed while processing acceptance.",
    "fr": "Le statut du rendez-vous a changé pendant l’acceptation. Actualisez la liste.",
    "zh-CN": "接受预约时状态已变化，请刷新后核对。"
  },
  "Only pending appointments can be rejected.": {
    "en": "Only pending appointments can be rejected.",
    "fr": "Seuls les rendez-vous en attente peuvent être refusés.",
    "zh-CN": "仅待确认的预约可以拒绝，请刷新预约状态。"
  },
  "Appointment status changed while processing rejection.": {
    "en": "Appointment status changed while processing rejection.",
    "fr": "Le statut du rendez-vous a changé pendant le refus. Actualisez la liste.",
    "zh-CN": "拒绝预约时状态已变化，请刷新后核对。"
  },
  "The amount does not match the currency's settlement unit.": {
    "en": "The amount does not match the currency's settlement unit.",
    "fr": "Le montant n’est pas compatible avec l’unité de règlement de cette devise.",
    "zh-CN": "金额不符合此币种的结算单位，请调整金额。"
  },
  "Idempotency key is already used for another payment.": {
    "en": "Idempotency key is already used for another payment.",
    "fr": "Cet identifiant est déjà utilisé pour un autre paiement. Vérifiez les paiements existants.",
    "zh-CN": "此操作标识已用于另一笔收款，请核对已有收款记录。"
  },
  "Order is not payable in its current payment state.": {
    "en": "Order is not payable in its current payment state.",
    "fr": "Le statut actuel de la commande ne permet pas un paiement.",
    "zh-CN": "订单当前状态不支持收款，请同步后核对。"
  },
  "Order already has a pending app payment.": {
    "en": "Order already has a pending app payment.",
    "fr": "Un paiement d’application est déjà en attente pour cette commande. Contactez le magasin.",
    "zh-CN": "订单已有待处理的 App 支付，请联系门店核对。"
  },
  "Payment has not been attached to the gateway.": {
    "en": "Payment has not been attached to the gateway.",
    "fr": "Le paiement n’est pas encore lié au prestataire. Réessayez plus tard.",
    "zh-CN": "收款尚未关联支付渠道，请稍后重试。"
  },
  "An active refund request already exists for this order.": {
    "en": "An active refund request already exists for this order.",
    "fr": "Une demande de remboursement est déjà en cours pour cette commande.",
    "zh-CN": "此订单已有待处理的退款申请，请勿重复提交。"
  },
  "Only pending refund requests can be approved.": {
    "en": "Only pending refund requests can be approved.",
    "fr": "Seules les demandes de remboursement en attente peuvent être approuvées.",
    "zh-CN": "仅待审批的退款申请可以批准，请刷新状态。"
  },
  "Refund request changed while approving.": {
    "en": "Refund request changed while approving.",
    "fr": "La demande de remboursement a changé pendant l’approbation. Actualisez les données.",
    "zh-CN": "审批时退款申请已变化，请刷新并核对结果。"
  },
  "Only unprocessed refund requests can be rejected.": {
    "en": "Only unprocessed refund requests can be rejected.",
    "fr": "Seules les demandes de remboursement non réglées peuvent être refusées.",
    "zh-CN": "仅尚未实际退款的申请可以拒绝。"
  },
  "Refund request changed while rejecting.": {
    "en": "Refund request changed while rejecting.",
    "fr": "La demande de remboursement a changé pendant le refus. Actualisez les données.",
    "zh-CN": "拒绝时退款申请已变化，请刷新并核对结果。"
  }

};
