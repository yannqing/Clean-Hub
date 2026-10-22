const en = {
  title: "Service item catalog",
  description:
    "Maintain item types and articles, then assign them to tenants. Services and prices remain tenant-managed.",
  loading: "Loading item catalog…",
  failed: "The item catalog could not be loaded. Retry before continuing.",
  retry: "Retry",
  save: "Save catalog",
  saving: "Saving…",
  saved: "Catalog saved",
  saveFailed: "Could not save. Check the names and selections, then try again.",
  conflict:
    "The catalog changed while you were editing. Refresh and review your selections before saving.",
  refresh: "Refresh catalog",
  enabled: "Enabled",
  inactive: "Inactive",
  groupName: "Type name",
  descriptionLabel: "Description",
  order: "Display order",
  article: "Article",
  articles: "Articles",
  add: "Add article",
  empty:
    "No articles yet. Add an article before enabling this type for a tenant.",
  namesHint: "Provide names in all three languages. Descriptions are optional.",
  selection: "Available service items",
  selectionHint:
    "Only selected types and articles can be added to work orders. This does not create services or prices.",
  legacy:
    "This tenant currently uses compatibility mode. Saving switches it to the selected articles; future platform articles require explicit selection. Older POS versions must be updated to use the article selector.",
  none: "No articles selected. Staff cannot add work-order items until articles are enabled.",
  all: "Select all",
  clear: "Clear all",
  readonly: "Only a SaaS super administrator can edit this catalog.",
  unavailable:
    "Inactive platform articles are excluded from this selection. Existing work orders remain available.",
  leave: "Discard unsaved catalog changes?",
  max: "Each type supports up to 200 articles.",
  selected: "selected",
  historical:
    "Disabling a type or article prevents new intake. Historical work orders retain their original names.",
  removeDraft: "Remove unsaved article",
  languages: { en: "English", fr: "French", "zh-CN": "Chinese" },
};
const zh: typeof en = {
  title: "服务物品目录",
  description: "维护物品类型和具体物品，再分配给租户。服务和价格仍由租户管理。",
  loading: "正在加载物品目录…",
  failed: "物品目录加载失败，请重试后继续。",
  retry: "重试",
  save: "保存目录",
  saving: "正在保存…",
  saved: "目录已保存",
  saveFailed: "保存失败，请检查名称和勾选内容后重试。",
  conflict: "目录已被其他管理员修改，请刷新并核对后再保存。",
  refresh: "刷新目录",
  enabled: "启用",
  inactive: "已停用",
  groupName: "类型名称",
  descriptionLabel: "描述",
  order: "显示顺序",
  article: "具体物品",
  articles: "具体物品",
  add: "新增物品",
  empty: "暂无具体物品，请先新增，再为租户启用此类型。",
  namesHint: "请填写三种语言的名称，描述可选。",
  selection: "可用服务物品",
  selectionHint:
    "只有勾选的类型和物品可以追加到工单中；勾选不会自动创建服务或价格。",
  legacy:
    "当前租户处于兼容模式。保存后将仅允许勾选的物品，平台后续新增物品需再次勾选；旧版 POS 需更新后才能使用物品选择器。",
  none: "尚未选择物品，员工暂时无法追加工单项目。",
  all: "全选",
  clear: "清空",
  readonly: "仅 SaaS 超级管理员可编辑目录。",
  unavailable: "已停用的平台物品不会纳入本次勾选，历史工单仍可查看。",
  leave: "放弃尚未保存的目录修改？",
  max: "每种类型最多支持 200 个物品。",
  selected: "已选择",
  historical: "停用类型或物品后不可新增收件，历史工单保留原有名称。",
  removeDraft: "移除未保存物品",
  languages: { en: "英语", fr: "法语", "zh-CN": "中文" },
};
const fr: typeof en = {
  title: "Catalogue des articles",
  description:
    "Gérez les types et articles, puis attribuez-les aux locataires. Les services et tarifs restent gérés par le locataire.",
  loading: "Chargement du catalogue…",
  failed: "Impossible de charger le catalogue. Réessayez avant de continuer.",
  retry: "Réessayer",
  save: "Enregistrer le catalogue",
  saving: "Enregistrement…",
  saved: "Catalogue enregistré",
  saveFailed:
    "Échec de l’enregistrement. Vérifiez les noms et sélections puis réessayez.",
  conflict:
    "Le catalogue a été modifié. Actualisez et vérifiez votre sélection avant d’enregistrer.",
  refresh: "Actualiser",
  enabled: "Actif",
  inactive: "Inactif",
  groupName: "Nom du type",
  descriptionLabel: "Description",
  order: "Ordre d’affichage",
  article: "Article",
  articles: "Articles",
  add: "Ajouter un article",
  empty:
    "Aucun article. Ajoutez-en un avant d’activer ce type pour un locataire.",
  namesHint:
    "Renseignez les noms dans les trois langues. Les descriptions sont facultatives.",
  selection: "Articles disponibles",
  selectionHint:
    "Seuls les types et articles sélectionnés peuvent être ajoutés aux bons de service. Aucun service ni tarif n’est créé.",
  legacy:
    "Ce locataire utilise le mode de compatibilité. L’enregistrement limite la saisie aux articles choisis. Les nouveaux articles devront être sélectionnés et les anciens POS mis à jour.",
  none: "Aucun article sélectionné. L’ajout aux bons de service est indisponible.",
  all: "Tout sélectionner",
  clear: "Tout effacer",
  readonly: "Seul un super administrateur SaaS peut modifier le catalogue.",
  unavailable:
    "Les articles inactifs sont exclus de cette sélection. Les bons historiques restent disponibles.",
  leave: "Abandonner les modifications non enregistrées ?",
  max: "Un type peut contenir jusqu’à 200 articles.",
  selected: "sélectionnés",
  historical:
    "La désactivation empêche les nouvelles saisies. Les bons historiques conservent leurs noms d’origine.",
  removeDraft: "Retirer l’article non enregistré",
  languages: { en: "Anglais", fr: "Français", "zh-CN": "Chinois" },
};
export function itemCatalogCopy(locale: string) {
  return locale === "zh-CN" ? zh : locale === "fr" ? fr : en;
}
