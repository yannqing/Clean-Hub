import type { SupportedLocale } from "@cleanhub/i18n";

import {
  POS_TEXT_TRANSLATIONS,
  type PosTextLocale,
} from "./pos-text-translations";

const HAN_RE = /[\u3400-\u9fff]/;

const POS_TEXT_TRANSLATION_OVERRIDES: Record<
  string,
  Record<PosTextLocale, string>
> = {
  业务记录: { en: "Business records", fr: "Dossiers" },
  共: { en: "Total", fr: "Total" },
  条: { en: "items", fr: "éléments" },
  第: { en: "Page", fr: "Page" },
  页: { en: "page", fr: "page" },
  个工单: { en: "tickets", fr: "tickets" },
  个项目: { en: "items", fr: "articles" },
  个客户档案: { en: "customer profiles", fr: "profils client" },
  件: { en: "items", fr: "articles" },
  保存: { en: "Save", fr: "Enregistrer" },
  "保存中…": { en: "Saving...", fr: "Enregistrement..." },
  取消: { en: "Cancel", fr: "Annuler" },
  删除: { en: "Delete", fr: "Supprimer" },
  编辑: { en: "Edit", fr: "Modifier" },
  重置: { en: "Reset", fr: "Réinitialiser" },
  查询: { en: "Search", fr: "Rechercher" },
  "加载中…": { en: "Loading...", fr: "Chargement..." },
  "加载中...": { en: "Loading...", fr: "Chargement..." },
  上一页: { en: "Previous", fr: "Précédent" },
  下一页: { en: "Next", fr: "Suivant" },
  每页: { en: "Per page", fr: "Par page" },
  操作: { en: "Actions", fr: "Actions" },
  状态: { en: "Status", fr: "Statut" },
  类型: { en: "Type", fr: "Type" },
  优先级: { en: "Priority", fr: "Priorité" },
  来源: { en: "Source", fr: "Source" },
  支付: { en: "Payment", fr: "Paiement" },
  金额: { en: "Amount", fr: "Montant" },
  折扣与优惠码: {
    en: "Discounts and discount codes",
    fr: "Remises et codes de réduction",
  },
  "自动折扣由系统计算，优惠码可在收款前应用或移除。": {
    en: "Automatic discounts are calculated by the system. Discount codes can be applied or removed before payment.",
    fr: "Les remises automatiques sont calculées par le système. Les codes de réduction peuvent être appliqués ou retirés avant le paiement.",
  },
  订单小计: { en: "Subtotal", fr: "Sous-total" },
  优惠金额: { en: "Discount", fr: "Remise" },
  应付总额: { en: "Total due", fr: "Total à payer" },
  确认零元订单: {
    en: "Confirm zero-total order",
    fr: "Confirmer la commande à total nul",
  },
  "当前订单应付金额为 0。确认零元订单后即可继续完成交付。": {
    en: "Nothing is due for this order. Confirm the zero-total order to continue to delivery.",
    fr: "Aucun montant n’est dû pour cette commande. Confirmez la commande à total nul pour poursuivre la livraison.",
  },
  已应用折扣: { en: "Applied discounts", fr: "Remises appliquées" },
  "暂无应用中的折扣。": {
    en: "No discounts are currently applied.",
    fr: "Aucune remise n’est actuellement appliquée.",
  },
  自动折扣: { en: "Automatic", fr: "Automatique" },
  优惠码: { en: "Discount code", fr: "Code de réduction" },
  商品或服务折扣: {
    en: "Product or service discount",
    fr: "Remise sur produit ou service",
  },
  "买 X 送 Y": { en: "Buy X get Y", fr: "Achetez X, obtenez Y" },
  订单折扣: { en: "Order discount", fr: "Remise sur la commande" },
  免配送费: { en: "Free delivery", fr: "Livraison gratuite" },
  移除: { en: "Remove", fr: "Retirer" },
  输入优惠码: {
    en: "Enter a discount code",
    fr: "Saisir un code de réduction",
  },
  "应用中…": { en: "Applying...", fr: "Application..." },
  应用优惠码: {
    en: "Apply code",
    fr: "Appliquer le code",
  },
  "订单收款或完成后不能再修改折扣。": {
    en: "Discounts cannot be changed after payment or order completion.",
    fr: "Les remises ne peuvent plus être modifiées après le paiement ou la finalisation de la commande.",
  },
  "仅店主或经理可以手动应用或移除优惠码。": {
    en: "Only an owner or manager can manually apply or remove discount codes.",
    fr: "Seul un propriétaire ou un responsable peut appliquer ou retirer manuellement des codes de réduction.",
  },
  "请先处理待确认的移动支付，再修改订单折扣。": {
    en: "Resolve the pending mobile payment before changing order discounts.",
    fr: "Traitez le paiement mobile en attente avant de modifier les remises de la commande.",
  },
  应用优惠码折扣: {
    en: "Apply discount code",
    fr: "Appliquer un code de réduction",
  },
  "应用后订单金额会重新计算，操作原因将写入审计记录。": {
    en: "The order will be recalculated and the reason will be recorded in the audit log.",
    fr: "La commande sera recalculée et le motif sera enregistré dans le journal d’audit.",
  },
  应用原因: { en: "Reason for applying", fr: "Motif de l’application" },
  填写应用优惠码的原因: {
    en: "Enter the reason for applying the discount code",
    fr: "Saisissez le motif de l’application du code de réduction",
  },
  确认应用: { en: "Confirm application", fr: "Confirmer l’application" },
  移除优惠码折扣: {
    en: "Remove discount code",
    fr: "Retirer le code de réduction",
  },
  "移除后订单金额会重新计算，操作原因将写入审计记录。": {
    en: "The order will be recalculated and the reason will be recorded in the audit log.",
    fr: "La commande sera recalculée et le motif sera enregistré dans le journal d’audit.",
  },
  移除原因: { en: "Reason for removal", fr: "Motif du retrait" },
  填写移除优惠码的原因: {
    en: "Enter the reason for removing the discount code",
    fr: "Saisissez le motif du retrait du code de réduction",
  },
  返回: { en: "Back", fr: "Retour" },
  "移除中…": { en: "Removing...", fr: "Retrait..." },
  确认移除: { en: "Confirm removal", fr: "Confirmer le retrait" },
  "请输入优惠码。": {
    en: "Enter a discount code.",
    fr: "Saisissez un code de réduction.",
  },
  "请填写应用原因。": {
    en: "Enter a reason for applying the discount code.",
    fr: "Saisissez un motif pour appliquer le code de réduction.",
  },
  "优惠码已应用。": {
    en: "Discount code applied.",
    fr: "Code de réduction appliqué.",
  },
  "请填写移除原因。": {
    en: "Enter a reason for removal.",
    fr: "Saisissez un motif de retrait.",
  },
  "优惠码折扣已移除。": {
    en: "Discount code removed.",
    fr: "Code de réduction retiré.",
  },
  "优惠码不存在、已停用或不适用于当前门店。": {
    en: "This discount code does not exist, is inactive, or is not available at this store.",
    fr: "Ce code de réduction n’existe pas, est inactif ou n’est pas disponible dans ce magasin.",
  },
  "当前订单不满足该折扣的使用条件。": {
    en: "This order does not meet the discount requirements.",
    fr: "Cette commande ne remplit pas les conditions de la remise.",
  },
  "该折扣不能与订单中已有的折扣叠加使用。": {
    en: "This discount cannot be combined with a discount already applied to the order.",
    fr: "Cette remise ne peut pas être cumulée avec une remise déjà appliquée à la commande.",
  },
  "本次折扣请求已失效，请重新提交。": {
    en: "This discount request has expired. Submit it again.",
    fr: "Cette demande de remise a expiré. Soumettez-la à nouveau.",
  },
  "该折扣记录不存在或已经被移除。": {
    en: "This discount application does not exist or has already been removed.",
    fr: "Cette remise n’existe pas ou a déjà été retirée.",
  },
  "自动折扣由适用规则控制，不能手动移除。": {
    en: "Automatic discounts are controlled by eligibility rules and cannot be removed manually.",
    fr: "Les remises automatiques sont contrôlées par les règles d’admissibilité et ne peuvent pas être retirées manuellement.",
  },
  备注: { en: "Notes", fr: "Notes" },
  日期: { en: "Date", fr: "Date" },
  客户: { en: "Customer", fr: "Client" },
  订单: { en: "Order", fr: "Commande" },
  工单: { en: "Ticket", fr: "Ticket" },
  项目: { en: "Item", fr: "Article" },
  服务: { en: "Service", fr: "Service" },
  草稿: { en: "Draft", fr: "Brouillon" },
  待处理: { en: "Pending", fr: "En attente" },
  处理中: { en: "In progress", fr: "En cours" },
  待取件: { en: "Ready for pickup", fr: "Prêt à récupérer" },
  已取件: { en: "Picked up", fr: "Récupéré" },
  已取消: { en: "Cancelled", fr: "Annulé" },
  异常: { en: "Exception", fr: "Exception" },
  已完成: { en: "Completed", fr: "Terminé" },
  已支付: { en: "Paid", fr: "Payé" },
  未支付: { en: "Unpaid", fr: "Non payé" },
  部分支付: { en: "Partially paid", fr: "Partiellement payé" },
  已退款: { en: "Refunded", fr: "Remboursé" },
  已交付: { en: "Delivered", fr: "Livré" },
  已逾期: { en: "Overdue", fr: "En retard" },
  今日销售额: { en: "Today's sales", fr: "Ventes du jour" },
  今日订单: { en: "Today's orders", fr: "Commandes du jour" },
  今日订单数: { en: "Today's orders", fr: "Commandes du jour" },
  今日新增: { en: "New today", fr: "Nouveaux aujourd'hui" },
  今日取件: { en: "Picked up today", fr: "Retraits du jour" },
  收款完成率: { en: "Payment completion", fr: "Encaissement terminé" },
  已收金额: { en: "Collected amount", fr: "Montant encaissé" },
  未收金额: { en: "Uncollected amount", fr: "Montant non encaissé" },
  销售额: { en: "Sales", fr: "Ventes" },
  已收: { en: "Collected", fr: "Encaissé" },
  未收: { en: "Uncollected", fr: "Non encaissé" },
  待收款订单: { en: "Orders to collect", fr: "Commandes à encaisser" },
  已完成订单: { en: "Completed orders", fr: "Commandes terminées" },
  已取消订单: { en: "Cancelled orders", fr: "Commandes annulées" },
  未支付与部分支付: {
    en: "Unpaid and partially paid",
    fr: "Non payées et partiellement payées",
  },
  已交付给客户: {
    en: "Delivered to customers",
    fr: "Livrées aux clients",
  },
  今日全部订单: { en: "All orders today", fr: "Toutes les commandes du jour" },
  收款情况: { en: "Payment status", fr: "Situation des encaissements" },
  收款对比图: {
    en: "Payment comparison chart",
    fr: "Graphique des encaissements",
  },
  今日收款对比图: {
    en: "Today's payment comparison chart",
    fr: "Graphique des encaissements du jour",
  },
  今日销售额与已收金额对比: {
    en: "Today's sales compared with collected amount",
    fr: "Ventes du jour comparées au montant encaissé",
  },
  "今日销售额、已收金额与未收金额对比": {
    en: "Today's sales, collected amount, and uncollected amount",
    fr: "Ventes du jour, montant encaissé et montant non encaissé",
  },
  订单结构: { en: "Order structure", fr: "Structure des commandes" },
  订单构成图: { en: "Order composition chart", fr: "Graphique des commandes" },
  今日订单构成图: {
    en: "Today's order composition chart",
    fr: "Graphique des commandes du jour",
  },
  完成: { en: "Completed", fr: "Terminées" },
  待收: { en: "To collect", fr: "À encaisser" },
  "今日订单完成、取消与待收款情况": {
    en: "Completed, cancelled, and receivable orders today",
    fr: "Commandes terminées, annulées et à encaisser aujourd'hui",
  },
  工单总数: { en: "Total tickets", fr: "Total des tickets" },
  全部工单: { en: "All tickets", fr: "Tous les tickets" },
  当前全部工单: { en: "All current tickets", fr: "Tous les tickets actuels" },
  当前工单池与今日流转概况: {
    en: "Current ticket pool and today's flow",
    fr: "Pool de tickets actuel et flux du jour",
  },
  工单状态图: { en: "Ticket status chart", fr: "Graphique des statuts" },
  工单状态分布图: {
    en: "Ticket status distribution chart",
    fr: "Graphique de répartition des statuts",
  },
  当前工单池按状态拆分: {
    en: "Current tickets broken down by status",
    fr: "Tickets actuels répartis par statut",
  },
  超过预计取件时间: {
    en: "Past estimated pickup time",
    fr: "Au-delà de l'heure de retrait prévue",
  },
  今日创建的工单: {
    en: "Tickets created today",
    fr: "Tickets créés aujourd'hui",
  },
  今日已取件: { en: "Picked up today", fr: "Retirés aujourd'hui" },
  暂无工单数据: { en: "No ticket data yet", fr: "Aucune donnée de ticket" },
  工单与客户结构图: {
    en: "Ticket and customer structure chart",
    fr: "Graphique tickets et clients",
  },
  工单状态和客户增长集中展示: {
    en: "Ticket status and customer growth in one view",
    fr: "Statuts des tickets et croissance client en une vue",
  },
  客户沉淀: { en: "Customer base", fr: "Base client" },
  客户增长图: {
    en: "Customer growth chart",
    fr: "Graphique de croissance client",
  },
  客户增长占比图: {
    en: "Customer growth share chart",
    fr: "Graphique de part de croissance client",
  },
  存量客户: { en: "Existing customers", fr: "Clients existants" },
  客户总数: { en: "Total customers", fr: "Total clients" },
  今日新增客户: {
    en: "New customers today",
    fr: "Nouveaux clients aujourd'hui",
  },
  新增客户占比: { en: "New customer share", fr: "Part des nouveaux clients" },
  客户运营概览: {
    en: "Customer operations overview",
    fr: "Aperçu des opérations client",
  },
  "账户、档案、服务参与度与新增趋势": {
    en: "Accounts, profiles, service engagement, and acquisition trend",
    fr: "Comptes, profils, engagement de service et tendance d'acquisition",
  },
  客户账户: { en: "Customer accounts", fr: "Comptes clients" },
  启用账户: { en: "Active accounts", fr: "Comptes actifs" },
  启用: { en: "Active", fr: "Actifs" },
  停用: { en: "Disabled", fr: "Désactivés" },
  客户档案: { en: "Customer profiles", fr: "Profils client" },
  可服务档案: { en: "Serviceable profiles", fr: "Profils servis" },
  启用档案: { en: "Active profiles", fr: "Profils actifs" },
  停用档案: { en: "Disabled profiles", fr: "Profils désactivés" },
  服务参与客户: { en: "Engaged customers", fr: "Clients engagés" },
  有订单: { en: "With orders", fr: "Avec commandes" },
  有工单: { en: "With tickets", fr: "Avec tickets" },
  复购客户: { en: "Repeat customers", fr: "Clients récurrents" },
  多次工单: { en: "Multiple tickets", fr: "Tickets multiples" },
  订单复购率: { en: "Order repeat rate", fr: "Taux de réachat" },
  "近 7 天新增客户": {
    en: "New customers in the last 7 days",
    fr: "Nouveaux clients sur 7 jours",
  },
  "近 7 天新增客户趋势": {
    en: "New customer trend over the last 7 days",
    fr: "Tendance des nouveaux clients sur 7 jours",
  },
  按客户账户创建日期统计: {
    en: "Grouped by customer account creation date",
    fr: "Regroupé par date de création du compte client",
  },
  个账户: { en: "accounts", fr: "comptes" },
  可服务客户账户: {
    en: "Active serviceable accounts",
    fr: "Comptes clients servis",
  },
  今日新建账户: {
    en: "Accounts created today",
    fr: "Comptes créés aujourd'hui",
  },
  还没有可展示的统计信息: {
    en: "No statistics to display yet",
    fr: "Aucune statistique à afficher",
  },
  "产生订单或工单后，这里会显示经营概况。": {
    en: "Once orders or tickets are created, the operating overview will appear here.",
    fr: "Une fois des commandes ou tickets créés, l'aperçu d'activité s'affichera ici.",
  },
  "查看门店经营数据：订单、工单和客户统计。": {
    en: "View store operating data across orders, tickets, and customers.",
    fr: "Consultez les données du magasin pour commandes, tickets et clients.",
  },
  快速操作: { en: "Quick actions", fr: "Actions rapides" },
  门店常用业务入口: {
    en: "Common store workflows",
    fr: "Parcours courants du magasin",
  },
  接待客户并创建服务工单: {
    en: "Receive customers and create service tickets",
    fr: "Accueillir les clients et créer des tickets de service",
  },
  "查询账户、档案与历史记录": {
    en: "Search accounts, profiles, and history",
    fr: "Rechercher comptes, profils et historique",
  },
  "跟进状态、取件与异常工单": {
    en: "Track status, pickups, and exceptions",
    fr: "Suivre les statuts, retraits et exceptions",
  },
  查看订单并处理现金收款: {
    en: "Review orders and collect cash payments",
    fr: "Consulter les commandes et encaisser en espèces",
  },
  进入对应业务页面: {
    en: "Open the related workflow",
    fr: "Ouvrir le parcours associé",
  },
  待办任务: { en: "Tasks", fr: "Tâches" },
  按优先级处理门店当前风险: {
    en: "Handle current store risks by priority",
    fr: "Traiter les risques du magasin par priorité",
  },
  处理: { en: "Handle", fr: "Traiter" },
  待处理事项: { en: "Pending workload", fr: "Charge en attente" },
  最近活动: { en: "Recent activity", fr: "Activité récente" },
  按时间倒序展示最近业务变化: {
    en: "Recent business changes in reverse time order",
    fr: "Changements récents par ordre chronologique inverse",
  },
  新订单: { en: "New order", fr: "Nouvelle commande" },
  新工单: { en: "New ticket", fr: "Nouveau ticket" },
  新客户: { en: "New customer", fr: "Nouveau client" },
  "金额:": { en: "Amount:", fr: "Montant :" },
  "工单号:": { en: "Ticket No.:", fr: "N° ticket :" },
  "客户:": { en: "Customer:", fr: "Client :" },
  实时数据: { en: "Live data", fr: "Données en direct" },
  "订单、收款、工单与客户的实时概览": {
    en: "Live overview of orders, payments, tickets, and customers",
    fr: "Aperçu en direct des commandes, paiements, tickets et clients",
  },
  订单收款: { en: "Order payments", fr: "Paiements des commandes" },
  销售额与实收金额对比: {
    en: "Sales compared with collected amount",
    fr: "Ventes comparées au montant encaissé",
  },
  实收占比: { en: "Collected ratio", fr: "Taux encaissé" },
  待收款: { en: "Receivable", fr: "À encaisser" },
  未付款订单: { en: "Unpaid orders", fr: "Commandes non payées" },
  工单动态: { en: "Ticket activity", fr: "Activité des tickets" },
  "今日创建、取件与逾期情况": {
    en: "Created today, picked up today, and overdue",
    fr: "Créés aujourd'hui, retirés aujourd'hui et en retard",
  },
  逾期工单: { en: "Overdue tickets", fr: "Tickets en retard" },
  今日新建: { en: "Created today", fr: "Créés aujourd'hui" },
  暂无收款: { en: "No payments yet", fr: "Aucun encaissement" },
  暂无客户: { en: "No customers yet", fr: "Aucun client" },
  暂无数据: { en: "No data yet", fr: "Aucune donnée" },
  客户增长: { en: "Customer growth", fr: "Croissance clients" },
  客户存量与今日新增: {
    en: "Customer base and today's additions",
    fr: "Base clients et nouveaux clients du jour",
  },
  总客户: { en: "Total customers", fr: "Total clients" },
  新增占比: { en: "New customer ratio", fr: "Taux de nouveaux clients" },
  统计数据: { en: "Statistics", fr: "Statistiques" },
  订单统计: { en: "Order statistics", fr: "Statistiques commandes" },
  工单统计: { en: "Ticket statistics", fr: "Statistiques tickets" },
  客户统计: { en: "Customer statistics", fr: "Statistiques clients" },
  工单状态分布: {
    en: "Ticket status distribution",
    fr: "Répartition des statuts",
  },
};

const POS_TEXT_TRANSLATION_DICTIONARY = {
  ...POS_TEXT_TRANSLATIONS,
  ...POS_TEXT_TRANSLATION_OVERRIDES,
};

let runtimeLocale: SupportedLocale = "zh-CN";

export function setPosRuntimeLocale(locale: SupportedLocale): void {
  runtimeLocale = locale;
}

export function getPosRuntimeLocale(): SupportedLocale {
  return runtimeLocale;
}

export function translatePosText(
  value: string,
  locale: SupportedLocale = runtimeLocale,
): string {
  if (locale === "zh-CN" || !HAN_RE.test(value)) {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized || !HAN_RE.test(normalized)) {
    return value;
  }

  const targetLocale = locale as PosTextLocale;
  const exact = POS_TEXT_TRANSLATION_DICTIONARY[normalized]?.[targetLocale];

  if (exact) {
    return `${leading}${exact}${trailing}`;
  }

  let translated = normalized;
  for (const [source, translations] of getPhraseEntries(targetLocale)) {
    translated = translated.split(source).join(translations);
  }

  /**
   * A half-substituted string is worse than an untranslated one.
   *
   * The loop replaces known phrases wherever they appear, so a sentence the
   * dictionary does not carry whole comes back spliced: 管理员 became
   * "manage员" and "gérer员", and 页面不存在 became "page面不存在". Mixed
   * Chinese and Latin inside one word reads as corruption to every operator,
   * while plain Chinese at least reads as "not translated yet".
   *
   * So the loop's output is only accepted once nothing Han is left in it.
   * Phrases that do resolve completely (共 3 条 -> Total 3 items) still win;
   * the rest fall back to the source text until the dictionary carries them.
   */
  if (HAN_RE.test(translated)) {
    return value;
  }

  return `${leading}${translated}${trailing}`;
}

function getPhraseEntries(
  locale: PosTextLocale,
): Array<readonly [string, string]> {
  return Object.entries(POS_TEXT_TRANSLATION_DICTIONARY)
    .filter(([source]) => HAN_RE.test(source))
    .sort(([left], [right]) => right.length - left.length)
    .map(([source, translations]) => [source, translations[locale]] as const);
}
