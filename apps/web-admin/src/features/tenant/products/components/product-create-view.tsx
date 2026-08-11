"use client";

import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@cleanhub/ui";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Store,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

import type { BranchSummary } from "../../branches/types";
import {
  createProductAction,
  getProductCategoryAttributesAction,
  updateProductAction,
  uploadProductMediaAction,
} from "../actions";
import type {
  CreateTenantProductCategoryAttribute,
  ProductFormErrors,
  ProductFormValues,
  TenantProductCategoryAttributeDefinition,
  TenantProductCategorySummary,
  TenantProductDetail,
  TenantProductStatus,
} from "../types";
import {
  normalizeProductTags,
  splitProductTagInput,
  validateProductForm,
} from "../validators";
import {
  CategoryMetafieldsEditor,
  type CategoryMetafieldsLoadState,
} from "./category-metafields-editor";
import { ProductRichTextEditor } from "./product-rich-text-editor";

const MAX_PRODUCT_IMAGES = 10;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UNCATEGORIZED_VALUE = "__uncategorized__";

type BranchInventoryValue = {
  openingStock: string;
  reorderPoint: string;
};

function normalizeWholeQuantityInput(value: string): string {
  const quantity = Number(value);

  return Number.isInteger(quantity) ? String(quantity) : value;
}

type ExistingProductImage = {
  kind: "existing";
  id: string;
  mediaId: string;
  objectKey: string;
  previewUrl: string;
};

type NewProductImage = {
  kind: "new";
  id: string;
  file: File;
  previewUrl: string;
  objectKey?: string;
  expiresAt?: string;
};

type SelectedProductImage = ExistingProductImage | NewProductImage;

function hasCategoryAttributeValue(
  attribute: CreateTenantProductCategoryAttribute,
): boolean {
  return typeof attribute.textValue === "string"
    ? attribute.textValue.trim().length > 0
    : attribute.optionIds.length > 0;
}

function createRequiredCategoryAttributes(
  definitions: TenantProductCategoryAttributeDefinition[],
): CreateTenantProductCategoryAttribute[] {
  return definitions
    .filter((definition) => definition.required)
    .map((definition) =>
      definition.valueType === "text"
        ? { definitionId: definition.id, textValue: "" }
        : { definitionId: definition.id, optionIds: [] },
    );
}

function mergeCategoryAttributes(
  definitions: TenantProductCategoryAttributeDefinition[],
  existingValues: CreateTenantProductCategoryAttribute[],
): CreateTenantProductCategoryAttribute[] {
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const values = existingValues.filter((value) =>
    definitionIds.has(value.definitionId),
  );
  const selectedDefinitionIds = new Set(
    values.map((value) => value.definitionId),
  );

  return [
    ...values,
    ...createRequiredCategoryAttributes(
      definitions.filter(
        (definition) => !selectedDefinitionIds.has(definition.id),
      ),
    ),
  ];
}

function getProductImageName(image: SelectedProductImage): string {
  if (image.kind === "new") {
    return image.file.name;
  }

  return image.objectKey.split("/").at(-1) || image.objectKey;
}

function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

type ProductCreateViewProps = {
  availableCurrencies?: string[];
  branches?: BranchSummary[];
  branchLoadFailed?: boolean;
  categories?: TenantProductCategorySummary[];
  categoryLoadFailed?: boolean;
  currencyLoadFailed?: boolean;
  defaultCurrency?: string | null;
  initialProduct?: TenantProductDetail;
  mode?: "create" | "edit";
};

export function ProductCreateView({
  availableCurrencies = [],
  branches = [],
  branchLoadFailed = false,
  categories = [],
  categoryLoadFailed = false,
  currencyLoadFailed = false,
  defaultCurrency = null,
  initialProduct,
  mode = "create",
}: ProductCreateViewProps) {
  const router = useRouter();
  const { m } = useTenantI18n();
  const isEditMode = mode === "edit";
  const initialPublishedBranchSettings =
    initialProduct?.branchSettings.filter((setting) => setting.isAvailable) ??
    [];
  const initialBranchSetting = initialPublishedBranchSettings[0];
  const initialBranchSettingsById = new Map(
    initialProduct?.branchSettings.map((setting) => [
      setting.branchId,
      setting,
    ]) ?? [],
  );
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<SelectedProductImage[]>([]);
  const categoryRequestSequenceRef = useRef(0);
  const initialCategoryAttributesRef = useRef(
    initialProduct?.categoryAttributes ?? [],
  );
  const [excludedBranchIds, setExcludedBranchIds] = useState<Set<string>>(
    () => {
      if (!isEditMode) {
        return new Set();
      }

      const publishedBranchIds = new Set(
        initialPublishedBranchSettings.map((setting) => setting.branchId),
      );

      return new Set(
        branches
          .filter((branch) => !publishedBranchIds.has(branch.id))
          .map((branch) => branch.id),
      );
    },
  );
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [draftExcludedBranchIds, setDraftExcludedBranchIds] = useState<
    Set<string>
  >(() => new Set());
  const [branchSearch, setBranchSearch] = useState("");
  const [branchInventory, setBranchInventory] = useState<
    Record<string, BranchInventoryValue>
  >(() =>
    Object.fromEntries(
      branches.map((branch) => [
        branch.id,
        {
          openingStock: normalizeWholeQuantityInput(
            initialBranchSettingsById.get(branch.id)?.onHandQuantity ?? "0",
          ),
          reorderPoint: normalizeWholeQuantityInput(
            initialBranchSettingsById.get(branch.id)?.reorderPoint ?? "0",
          ),
        },
      ]),
    ),
  );
  const [selectedImages, setSelectedImages] = useState<SelectedProductImage[]>(
    () =>
      [...(initialProduct?.media ?? [])]
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            Number(right.isPrimary) - Number(left.isPrimary),
        )
        .map((media) => ({
          kind: "existing",
          id: `existing-${media.id}`,
          mediaId: media.id,
          objectKey: media.objectKey,
          previewUrl: media.downloadUrl,
        })),
  );
  const [tags, setTags] = useState<string[]>(() => initialProduct?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [categoryId, setCategoryId] = useState(
    () => initialProduct?.categoryId ?? "",
  );
  const [categoryAttributes, setCategoryAttributes] = useState<
    CreateTenantProductCategoryAttribute[]
  >(() => initialProduct?.categoryAttributes ?? []);
  const [categoryAttributeDefinitions, setCategoryAttributeDefinitions] =
    useState<TenantProductCategoryAttributeDefinition[]>([]);
  const [categoryMetafieldsLoadState, setCategoryMetafieldsLoadState] =
    useState<CategoryMetafieldsLoadState>(
      initialProduct?.categoryId ? "loading" : "idle",
    );
  const [
    invalidCategoryAttributeDefinitionIds,
    setInvalidCategoryAttributeDefinitionIds,
  ] = useState<Set<string>>(() => new Set());
  const [
    categoryAttributesValidationAttempted,
    setCategoryAttributesValidationAttempted,
  ] = useState(false);
  const [status, setStatus] = useState<TenantProductStatus>(
    () => initialProduct?.status ?? "active",
  );
  const [unitOfMeasure, setUnitOfMeasure] = useState(
    () => initialProduct?.sku.unitOfMeasure ?? "piece",
  );
  const [trackInventory, setTrackInventory] = useState(
    () => initialProduct?.sku.trackInventory ?? true,
  );
  const [allowNegativeStock, setAllowNegativeStock] = useState(
    () => initialBranchSetting?.allowNegativeStock ?? false,
  );
  const [allowOfflineSale, setAllowOfflineSale] = useState(
    () => initialBranchSetting?.allowOfflineSale ?? false,
  );
  const [salePrice, setSalePrice] = useState(
    () => initialProduct?.salePrice ?? "",
  );
  const currency = initialProduct?.currency ?? defaultCurrency ?? "";
  const [referenceCost, setReferenceCost] = useState(
    () => initialProduct?.sku.referenceCost ?? "",
  );
  const [showMoreInventorySettings, setShowMoreInventorySettings] = useState(
    () =>
      Boolean(initialProduct?.sku.barcode) ||
      Boolean(initialBranchSetting?.allowNegativeStock) ||
      Boolean(initialBranchSetting?.allowOfflineSale),
  );
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const selectedBranches = useMemo(
    () => branches.filter((branch) => !excludedBranchIds.has(branch.id)),
    [branches, excludedBranchIds],
  );
  const selectedBranchCount = selectedBranches.length;
  const formUnavailable =
    branchLoadFailed ||
    categoryLoadFailed ||
    currencyLoadFailed ||
    availableCurrencies.length === 0 ||
    branches.length === 0 ||
    (isEditMode && !initialProduct);
  const allBranchesSelected =
    branches.length > 0 && selectedBranchCount === branches.length;
  const draftSelectedBranchCount =
    branches.length - draftExcludedBranchIds.size;
  const draftAllBranchesSelected =
    branches.length > 0 && draftSelectedBranchCount === branches.length;
  const draftBranchSelectionState =
    draftSelectedBranchCount === 0
      ? false
      : draftAllBranchesSelected
        ? true
        : "indeterminate";
  const normalizedBranchSearch = branchSearch.trim().toLowerCase();
  const filteredBranches = useMemo(
    () =>
      normalizedBranchSearch
        ? branches.filter(
            (branch) =>
              branch.name.toLowerCase().includes(normalizedBranchSearch) ||
              branch.address?.toLowerCase().includes(normalizedBranchSearch),
          )
        : branches,
    [branches, normalizedBranchSearch],
  );
  const price = Number(salePrice);
  const cost = Number(referenceCost);
  const canCalculateProfit =
    salePrice.trim() !== "" &&
    referenceCost.trim() !== "" &&
    Number.isFinite(price) &&
    Number.isFinite(cost);
  const profit = canCalculateProfit ? price - cost : null;
  const profitMargin =
    profit !== null && price > 0 ? (profit / price) * 100 : null;

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    const initialCategoryId = initialProduct?.categoryId;

    if (!initialCategoryId) {
      return;
    }

    const requestSequence = ++categoryRequestSequenceRef.current;

    void getProductCategoryAttributesAction(initialCategoryId).then(
      (result) => {
        if (requestSequence !== categoryRequestSequenceRef.current) {
          return;
        }

        if (!result.ok) {
          setCategoryMetafieldsLoadState("error");
          return;
        }

        const definitions = [...result.data.data].sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.code.localeCompare(right.code),
        );

        setCategoryAttributeDefinitions(definitions);
        setCategoryAttributes(
          mergeCategoryAttributes(
            definitions,
            initialCategoryAttributesRef.current,
          ),
        );
        setCategoryMetafieldsLoadState("loaded");
      },
    );
  }, [initialProduct?.categoryId]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty && !saving) {
      return;
    }

    function handleDocumentLink(event: globalThis.MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[href]");

      if (!link || link.target === "_blank" || link.hasAttribute("download")) {
        return;
      }

      const destination = new URL(link.href, window.location.href);

      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href
      ) {
        return;
      }

      if (
        saving ||
        (isDirty && !window.confirm(m.products.create.unsavedChanges))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    document.addEventListener("click", handleDocumentLink, true);
    return () =>
      document.removeEventListener("click", handleDocumentLink, true);
  }, [isDirty, m.products.create.unsavedChanges, saving]);

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((image) => {
        if (image.kind === "new") {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    },
    [],
  );

  function getErrorMessage(field: keyof ProductFormValues): string | undefined {
    const errorCode = errors[field];

    return errorCode
      ? m.products.create.validation[
          errorCode as keyof typeof m.products.create.validation
        ]
      : undefined;
  }

  function clearFieldError(field: keyof ProductFormValues) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function markChanged(field?: keyof ProductFormValues) {
    setIsDirty(true);
    if (field) {
      clearFieldError(field);
    }
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const fieldName = target.name as keyof ProductFormValues;

    setIsDirty(true);

    if (fieldName && fieldName in errors) {
      clearFieldError(fieldName);
    }
  }

  async function loadCategoryAttributeDefinitions(
    nextCategoryId: string,
    existingValues: CreateTenantProductCategoryAttribute[] = [],
  ) {
    const requestSequence = ++categoryRequestSequenceRef.current;

    setCategoryMetafieldsLoadState("loading");
    setCategoryAttributeDefinitions([]);
    setCategoryAttributes([]);
    setInvalidCategoryAttributeDefinitionIds(new Set());
    setCategoryAttributesValidationAttempted(false);
    clearFieldError("categoryAttributes");

    const result = await getProductCategoryAttributesAction(nextCategoryId);

    if (requestSequence !== categoryRequestSequenceRef.current) {
      return;
    }

    if (!result.ok) {
      setCategoryMetafieldsLoadState("error");
      return;
    }

    const definitions = [...result.data.data].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
    );

    setCategoryAttributeDefinitions(definitions);
    setCategoryAttributes(mergeCategoryAttributes(definitions, existingValues));
    setCategoryMetafieldsLoadState("loaded");
  }

  function handleCategoryChange(value: string) {
    const nextCategoryId = value === UNCATEGORIZED_VALUE ? "" : value;

    if (nextCategoryId === categoryId) {
      return;
    }

    if (
      categoryAttributes.some(hasCategoryAttributeValue) &&
      !window.confirm(m.products.create.categoryMetafields.changeConfirm)
    ) {
      return;
    }

    categoryRequestSequenceRef.current += 1;
    setCategoryId(nextCategoryId);
    setCategoryAttributes([]);
    setCategoryAttributeDefinitions([]);
    setInvalidCategoryAttributeDefinitionIds(new Set());
    setCategoryAttributesValidationAttempted(false);
    setCategoryMetafieldsLoadState(nextCategoryId ? "loading" : "idle");
    markChanged("categoryId");
    clearFieldError("categoryAttributes");

    if (nextCategoryId) {
      void loadCategoryAttributeDefinitions(nextCategoryId);
    }
  }

  function handleCategoryAttributesChange(
    nextAttributes: CreateTenantProductCategoryAttribute[],
  ) {
    setCategoryAttributes(nextAttributes);
    setInvalidCategoryAttributeDefinitionIds(
      categoryAttributesValidationAttempted
        ? new Set(
            nextAttributes
              .filter((attribute) => !hasCategoryAttributeValue(attribute))
              .map((attribute) => attribute.definitionId),
          )
        : new Set(),
    );
    markChanged("categoryAttributes");
  }

  function retryCategoryAttributeDefinitions() {
    if (categoryId) {
      void loadCategoryAttributeDefinitions(categoryId, categoryAttributes);
    }
  }

  function openBranchDialog() {
    setDraftExcludedBranchIds(new Set(excludedBranchIds));
    setBranchSearch("");
    setBranchDialogOpen(true);
  }

  function handleAllBranchesChange(checked: boolean | "indeterminate") {
    setDraftExcludedBranchIds(
      checked === true
        ? new Set()
        : new Set(branches.map((branch) => branch.id)),
    );
  }

  function handleBranchChange(
    branchId: string,
    checked: boolean | "indeterminate",
  ) {
    setDraftExcludedBranchIds((current) => {
      const next = new Set(current);

      if (checked === true) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }

      return next;
    });
  }

  function confirmBranchSelection() {
    if (!setsEqual(excludedBranchIds, draftExcludedBranchIds)) {
      setExcludedBranchIds(new Set(draftExcludedBranchIds));
      markChanged("branchSettings");
    }

    setBranchDialogOpen(false);
  }

  function updateBranchInventory(
    branchId: string,
    field: keyof BranchInventoryValue,
    value: string,
  ) {
    setBranchInventory((current) => ({
      ...current,
      [branchId]: {
        openingStock: current[branchId]?.openingStock ?? "0",
        reorderPoint: current[branchId]?.reorderPoint ?? "0",
        [field]: value,
      },
    }));
    markChanged("branchSettings");
  }

  function addTags(value: string) {
    const nextTags = splitProductTagInput(value);

    if (nextTags.every((tag) => !tag.trim())) {
      return;
    }

    setTags((current) => normalizeProductTags([...current, ...nextTags]));
    setTagInput("");
    markChanged("tags");
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" || event.key === "," || event.key === "，") {
      event.preventDefault();
      addTags(tagInput);
      return;
    }

    if (event.key === "Backspace" && tagInput.length === 0) {
      setTags((current) => current.slice(0, -1));
      markChanged("tags");
    }
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
    markChanged("tags");
  }

  function addProductImages(files: File[]) {
    let invalidType = false;
    let oversized = false;
    const validFiles = files.filter((file) => {
      if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
        invalidType = true;
        return false;
      }

      if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
        oversized = true;
        return false;
      }

      return true;
    });

    if (invalidType) {
      toast.error(m.products.create.mediaTypeInvalid);
    }
    if (oversized) {
      toast.error(m.products.create.mediaTooLarge);
    }

    const existingFiles = new Set(
      selectedImages.flatMap((image) =>
        image.kind === "new"
          ? [`${image.file.name}:${image.file.size}:${image.file.lastModified}`]
          : [],
      ),
    );
    const availableSlots = MAX_PRODUCT_IMAGES - selectedImages.length;
    const newFiles = validFiles.filter(
      (file) =>
        !existingFiles.has(`${file.name}:${file.size}:${file.lastModified}`),
    );
    const uniqueFiles = newFiles.slice(0, availableSlots);

    if (uniqueFiles.length < newFiles.length) {
      toast.error(m.products.create.mediaLimitReached);
    }

    if (uniqueFiles.length > 0) {
      setSelectedImages((current) => [
        ...current,
        ...uniqueFiles.map((file) => ({
          kind: "new" as const,
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
      markChanged("mediaObjectKeys");
    }
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    addProductImages(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function removeProductImage(imageId: string) {
    const image = selectedImages.find((item) => item.id === imageId);

    if (image?.kind === "new") {
      URL.revokeObjectURL(image.previewUrl);
    }

    setSelectedImages((current) =>
      current.filter((item) => item.id !== imageId),
    );
    markChanged("mediaObjectKeys");
  }

  async function uploadPendingImages(): Promise<string[] | null> {
    const objectKeys: string[] = [];

    for (const image of selectedImages) {
      if (image.kind === "existing") {
        continue;
      }

      const uploadExpiresAt = image.expiresAt
        ? new Date(image.expiresAt).getTime()
        : 0;

      if (
        image.objectKey &&
        Number.isFinite(uploadExpiresAt) &&
        uploadExpiresAt - Date.now() > 60_000
      ) {
        objectKeys.push(image.objectKey);
        continue;
      }

      const result = await uploadProductMediaAction({
        contentType: image.file.type,
        sizeBytes: image.file.size,
      });

      if (!result.ok) {
        toast.error(
          result.reason === "type"
            ? m.products.create.mediaTypeInvalid
            : result.reason === "size"
              ? m.products.create.mediaTooLarge
              : m.products.create.mediaUploadFailed,
        );
        return null;
      }

      let uploadResponse: Response;

      try {
        uploadResponse = await fetch(result.ticket.uploadUrl, {
          method: "PUT",
          headers: result.ticket.headers,
          body: image.file,
        });
      } catch {
        toast.error(m.products.create.mediaUploadFailed);
        return null;
      }

      if (!uploadResponse.ok) {
        toast.error(m.products.create.mediaUploadFailed);
        return null;
      }

      objectKeys.push(result.ticket.objectKey);
      setSelectedImages((current) =>
        current.map((item) =>
          item.kind === "new" && item.id === image.id
            ? {
                ...item,
                objectKey: result.ticket.objectKey,
                expiresAt: result.ticket.expiresAt,
              }
            : item,
        ),
      );
    }

    return objectKeys;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (categoryId && categoryMetafieldsLoadState !== "loaded") {
      toast.error(m.products.create.categoryMetafields.loadFailed);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const pendingTags = splitProductTagInput(tagInput);
    const formValues: ProductFormValues = {
      name: String(formData.get("name") ?? ""),
      categoryId,
      categoryAttributes,
      brand: String(formData.get("brand") ?? ""),
      description: String(formData.get("description") ?? ""),
      tags: normalizeProductTags([...tags, ...pendingTags]),
      mediaObjectKeys: selectedImages.flatMap((image) =>
        image.kind === "new" && image.objectKey ? [image.objectKey] : [],
      ),
      status,
      skuCode: String(formData.get("skuCode") ?? ""),
      barcode: String(formData.get("barcode") ?? ""),
      variantName: String(formData.get("variantName") ?? ""),
      unitOfMeasure,
      unitsPerSale: "1",
      salePrice,
      currency,
      referenceCost,
      trackInventory,
      allowNegativeStock: trackInventory && allowNegativeStock,
      allowOfflineSale,
      branchSettings: selectedBranches.map((branch) => {
        const inventory = branchInventory[branch.id] ?? {
          openingStock: "0",
          reorderPoint: "0",
        };

        return {
          branchId: branch.id,
          openingStock: trackInventory ? inventory.openingStock : "0",
          reorderPoint: trackInventory ? inventory.reorderPoint : "0",
        };
      }),
    };
    const clientValidation = validateProductForm(formValues, mode);
    setCategoryAttributesValidationAttempted(true);

    if (!clientValidation.ok) {
      setErrors(clientValidation.errors);
      setInvalidCategoryAttributeDefinitionIds(
        new Set(clientValidation.invalidCategoryAttributeDefinitionIds),
      );
      toast.error(m.products.create.checkForm);
      return;
    }

    setSaving(true);
    setErrors({});
    setInvalidCategoryAttributeDefinitionIds(new Set());

    try {
      const mediaObjectKeys = await uploadPendingImages();

      if (mediaObjectKeys === null) {
        return;
      }

      formValues.mediaObjectKeys = mediaObjectKeys;
      const retainedMediaIds = selectedImages.flatMap((image) =>
        image.kind === "existing" ? [image.mediaId] : [],
      );
      const result =
        isEditMode && initialProduct
          ? await updateProductAction(
              initialProduct.id,
              initialProduct.version,
              initialProduct.sku.id,
              initialProduct.sku.version,
              formValues,
              retainedMediaIds,
              Object.fromEntries(
                initialProduct.branchSettings.map((setting) => [
                  setting.branchId,
                  setting.onHandQuantity,
                ]),
              ),
            )
          : await createProductAction(formValues);

      if (!result.ok) {
        const isMediaError = result.code?.startsWith("PRODUCT_MEDIA_") ?? false;

        if (isMediaError) {
          setSelectedImages((current) =>
            current.map((image) =>
              image.kind === "existing"
                ? image
                : {
                    kind: "new",
                    id: image.id,
                    file: image.file,
                    previewUrl: image.previewUrl,
                  },
            ),
          );
        }

        setErrors({
          ...result.errors,
          ...(isMediaError ? { mediaObjectKeys: "mediaInvalid" as const } : {}),
        });
        setInvalidCategoryAttributeDefinitionIds(
          new Set(result.invalidCategoryAttributeDefinitionIds ?? []),
        );
        toast.error(
          isMediaError
            ? m.products.create.mediaCreateConflict
            : result.code === "PRODUCT_VERSION_CONFLICT" ||
                result.code === "PRODUCT_SKU_VERSION_CONFLICT"
              ? m.products.edit.versionConflict
              : result.code === "PRODUCT_INVENTORY_CONFLICT"
                ? m.products.edit.inventoryConflict
                : Object.keys(result.errors).length > 0
                  ? m.products.create.checkForm
                  : result.code === "PRODUCT_SKU_CODE_DUPLICATE" ||
                      result.code === "PRODUCT_BARCODE_DUPLICATE"
                    ? m.products.create.productConflict
                    : isEditMode
                      ? m.products.edit.updateFailed
                      : m.products.create.createFailed,
        );
        return;
      }

      setIsDirty(false);
      toast.success(
        isEditMode ? m.products.edit.updated : m.products.create.created,
      );
      router.push(webAdminRoutes.tenant.products);
      router.refresh();
    } catch {
      toast.error(
        isEditMode
          ? m.products.edit.updateFailed
          : m.products.create.createFailed,
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedBranchCopy = m.products.create.selectedBranchCount
    .replace("{selected}", String(selectedBranchCount))
    .replace("{total}", String(branches.length));
  const pageTitle = isEditMode
    ? m.products.edit.title
    : m.products.create.title;
  const stockQuantityLabel = isEditMode
    ? m.products.edit.stockOnHand
    : m.products.create.fields.openingStock;

  return (
    <section
      className="mx-auto w-full max-w-[960px] space-y-3 pb-20"
      data-mode={mode}
      data-testid="tenant-product-create-view"
    >
      <h1 className="sr-only">{pageTitle}</h1>
      <nav aria-label={m.products.create.breadcrumbLabel}>
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link
              aria-label={m.products.title}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.tenant.products}
              title={m.products.title}
            >
              <Icon aria-hidden icon={Package} size={16} />
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground">
            <Icon icon={ChevronRight} size={14} />
          </li>
          <li>
            <span aria-current="page" className="font-medium">
              {pageTitle}
            </span>
          </li>
        </ol>
      </nav>

      <form
        aria-busy={saving}
        className="space-y-5"
        noValidate
        onInput={handleFormInput}
        onSubmit={handleSubmit}
      >
        {branchLoadFailed || categoryLoadFailed || currencyLoadFailed ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {isEditMode
              ? m.products.edit.loadFailed
              : m.products.create.loadFailed}
          </p>
        ) : null}
        {isEditMode && initialProduct && initialProduct.skuCount > 1 ? (
          <p className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
            {m.products.edit.multipleSkuNotice}
          </p>
        ) : null}

        <fieldset className="contents" disabled={saving || formUnavailable}>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="product-name">
                      {m.products.create.fields.name} <RequiredMark />
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.name)}
                      aria-required="true"
                      defaultValue={initialProduct?.name ?? ""}
                      id="product-name"
                      maxLength={200}
                      name="name"
                      placeholder={m.products.create.placeholders.name}
                      required
                    />
                    <FieldError message={getErrorMessage("name")} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="product-description">
                      {m.products.create.fields.description}
                    </Label>
                    <ProductRichTextEditor
                      aria-invalid={Boolean(errors.description)}
                      id="product-description"
                      initialValue={initialProduct?.description ?? ""}
                      maxLength={5000}
                      name="description"
                      onChange={() => markChanged("description")}
                      placeholder={m.products.create.placeholders.description}
                    />
                    <FieldError message={getErrorMessage("description")} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="product-category">
                      {m.products.create.fields.category}
                    </Label>
                    <Select
                      name="categoryId"
                      onValueChange={handleCategoryChange}
                      value={categoryId || UNCATEGORIZED_VALUE}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.categoryId)}
                        className="w-full"
                        id="product-category"
                      >
                        <SelectValue
                          placeholder={m.products.create.placeholders.category}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNCATEGORIZED_VALUE}>
                          {m.products.create.categoryMetafields.uncategorized}
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {(category.code
                              ? m.products.create.taxonomy.categories[
                                  category.code
                                ]
                              : undefined) || category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={getErrorMessage("categoryId")} />
                  </div>

                  {categoryId ? (
                    <div className="border-t pt-4">
                      <CategoryMetafieldsEditor
                        definitions={categoryAttributeDefinitions}
                        disabled={saving || formUnavailable}
                        error={getErrorMessage("categoryAttributes")}
                        invalidDefinitionIds={
                          invalidCategoryAttributeDefinitionIds
                        }
                        loadState={categoryMetafieldsLoadState}
                        onChange={handleCategoryAttributesChange}
                        onRetry={retryCategoryAttributeDefinitions}
                        values={categoryAttributes}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-3 border-t pt-4">
                    <Label htmlFor="product-images">
                      {m.products.create.fields.media}
                    </Label>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      id="product-images"
                      multiple
                      onChange={handleImageSelection}
                      ref={imageInputRef}
                      type="file"
                    />

                    {selectedImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {selectedImages.map((image, index) => (
                          <div
                            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                            key={image.id}
                          >
                            <Image
                              alt={getProductImageName(image)}
                              className="object-cover"
                              fill
                              priority={index === 0}
                              sizes="(max-width: 640px) 50vw, 150px"
                              src={image.previewUrl}
                              unoptimized
                            />
                            <Button
                              aria-label={`${m.products.create.removeImage} ${getProductImageName(image)}`}
                              className="absolute right-1.5 top-1.5 size-7 bg-background/90 opacity-100 shadow-sm sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={() => removeProductImage(image.id)}
                              size="icon"
                              type="button"
                              variant="outline"
                            >
                              <Icon aria-hidden icon={X} size={13} />
                            </Button>
                          </div>
                        ))}

                        {selectedImages.length < MAX_PRODUCT_IMAGES ? (
                          <button
                            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
                            onClick={() => imageInputRef.current?.click()}
                            type="button"
                          >
                            <Icon aria-hidden icon={ImagePlus} size={20} />
                            <span>{m.products.create.addImages}</span>
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
                        onClick={() => imageInputRef.current?.click()}
                        type="button"
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                          <Icon aria-hidden icon={Upload} size={17} />
                        </span>
                        <span className="font-medium text-foreground">
                          {m.products.create.addImages}
                        </span>
                        <span className="text-xs">
                          {m.products.create.mediaHelp}
                        </span>
                      </button>
                    )}
                    <FieldError message={getErrorMessage("mediaObjectKeys")} />
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="product-sale-price">
                        {m.products.create.fields.salePrice} <RequiredMark />
                      </Label>
                      <Input
                        aria-invalid={Boolean(errors.salePrice)}
                        aria-required="true"
                        id="product-sale-price"
                        min="0"
                        name="salePrice"
                        onChange={(event) => {
                          setSalePrice(event.target.value);
                          markChanged("salePrice");
                        }}
                        placeholder="0.00"
                        required
                        step="0.01"
                        type="number"
                        value={salePrice}
                      />
                      <FieldError message={getErrorMessage("salePrice")} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="product-currency">
                        {m.products.create.fields.currency} <RequiredMark />
                      </Label>
                      <Input
                        aria-readonly="true"
                        id="product-currency"
                        name="currency"
                        readOnly
                        value={currency}
                      />
                      <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {isEditMode
                            ? m.products.create.existingCurrencyNotice
                            : m.products.create.currencyFromSettings}
                        </span>
                        <Link
                          className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline"
                          href={
                            webAdminRoutes.tenant.system.settingsSections
                              .pricing
                          }
                        >
                          {m.products.create.changeDefaultCurrency}
                        </Link>
                      </div>
                      <FieldError message={getErrorMessage("currency")} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="product-reference-cost">
                      {m.products.create.fields.referenceCost}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.referenceCost)}
                      id="product-reference-cost"
                      min="0"
                      name="referenceCost"
                      onChange={(event) => {
                        setReferenceCost(event.target.value);
                        markChanged("referenceCost");
                      }}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={referenceCost}
                    />
                    <FieldError message={getErrorMessage("referenceCost")} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-muted/60 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">
                        {m.products.create.fields.profit}
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {profit === null
                          ? "—"
                          : `${currency.trim().toUpperCase()} ${profit.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/60 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">
                        {m.products.create.fields.profitMargin}
                      </p>
                      <p className="mt-1 text-sm font-medium tabular-nums">
                        {profitMargin === null
                          ? "—"
                          : `${profitMargin.toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                    htmlFor="product-track-inventory"
                  >
                    <Checkbox
                      checked={trackInventory}
                      id="product-track-inventory"
                      name="trackInventory"
                      onCheckedChange={(checked) => {
                        const enabled = checked === true;

                        setTrackInventory(enabled);
                        if (!enabled) {
                          setAllowNegativeStock(false);
                        }
                        markChanged("trackInventory");
                        clearFieldError("branchSettings");
                      }}
                    />
                    <span className="text-sm font-medium">
                      {m.products.create.fields.trackInventory}
                    </span>
                  </label>

                  <div className="grid gap-2">
                    <Label htmlFor="product-sku-code">
                      {m.products.create.fields.skuCode} <RequiredMark />
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.skuCode)}
                      aria-required="true"
                      defaultValue={initialProduct?.sku.skuCode ?? ""}
                      id="product-sku-code"
                      maxLength={80}
                      name="skuCode"
                      placeholder={m.products.create.placeholders.skuCode}
                      required
                    />
                    <FieldError message={getErrorMessage("skuCode")} />
                  </div>

                  {trackInventory && selectedBranches.length > 0 ? (
                    <div className="overflow-hidden rounded-md border">
                      <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                        <span>{m.products.create.fields.branch}</span>
                        <span>{stockQuantityLabel}</span>
                        <span>{m.products.create.fields.reorderPoint}</span>
                      </div>
                      <div className="divide-y">
                        {selectedBranches.map((branch) => {
                          const inventory = branchInventory[branch.id] ?? {
                            openingStock: "0",
                            reorderPoint: "0",
                          };

                          return (
                            <div
                              className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center"
                              key={branch.id}
                            >
                              <span
                                className="min-w-0 truncate text-sm font-medium"
                                title={branch.name}
                              >
                                {branch.name}
                              </span>
                              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:block">
                                <Label
                                  className="text-xs text-muted-foreground sm:sr-only"
                                  htmlFor={`product-opening-stock-${branch.id}`}
                                >
                                  {stockQuantityLabel}
                                </Label>
                                <Input
                                  aria-label={`${branch.name} ${stockQuantityLabel}`}
                                  id={`product-opening-stock-${branch.id}`}
                                  min={isEditMode ? undefined : "0"}
                                  onChange={(event) =>
                                    updateBranchInventory(
                                      branch.id,
                                      "openingStock",
                                      event.target.value,
                                    )
                                  }
                                  inputMode="numeric"
                                  step="1"
                                  type="number"
                                  value={inventory.openingStock}
                                />
                              </div>
                              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:block">
                                <Label
                                  className="text-xs text-muted-foreground sm:sr-only"
                                  htmlFor={`product-reorder-point-${branch.id}`}
                                >
                                  {m.products.create.fields.reorderPoint}
                                </Label>
                                <Input
                                  aria-label={`${branch.name} ${m.products.create.fields.reorderPoint}`}
                                  id={`product-reorder-point-${branch.id}`}
                                  min="0"
                                  onChange={(event) =>
                                    updateBranchInventory(
                                      branch.id,
                                      "reorderPoint",
                                      event.target.value,
                                    )
                                  }
                                  inputMode="numeric"
                                  step="1"
                                  type="number"
                                  value={inventory.reorderPoint}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <FieldError message={getErrorMessage("branchSettings")} />

                  <Button
                    aria-controls="product-more-inventory-settings"
                    aria-expanded={showMoreInventorySettings}
                    className="w-fit gap-1 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() =>
                      setShowMoreInventorySettings((current) => !current)
                    }
                    type="button"
                    variant="ghost"
                  >
                    {showMoreInventorySettings
                      ? m.products.create.hideMoreSettings
                      : m.products.create.showMoreSettings}
                    <Icon
                      aria-hidden
                      className={
                        showMoreInventorySettings
                          ? "rotate-180 transition-transform"
                          : "transition-transform"
                      }
                      icon={ChevronDown}
                      size={14}
                    />
                  </Button>

                  {showMoreInventorySettings ? (
                    <div
                      className="grid gap-4 border-t pt-4"
                      id="product-more-inventory-settings"
                    >
                      <div className="grid gap-2">
                        <Label htmlFor="product-barcode">
                          {m.products.create.fields.barcode}
                        </Label>
                        <Input
                          aria-invalid={Boolean(errors.barcode)}
                          defaultValue={initialProduct?.sku.barcode ?? ""}
                          id="product-barcode"
                          maxLength={80}
                          name="barcode"
                          placeholder={m.products.create.placeholders.barcode}
                        />
                        <FieldError message={getErrorMessage("barcode")} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label
                          className="flex items-center gap-3 rounded-md border p-3 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50"
                          data-disabled={!trackInventory}
                          htmlFor="product-negative-stock"
                        >
                          <Checkbox
                            checked={allowNegativeStock}
                            disabled={!trackInventory}
                            id="product-negative-stock"
                            name="allowNegativeStock"
                            onCheckedChange={(checked) => {
                              setAllowNegativeStock(checked === true);
                              markChanged("allowNegativeStock");
                            }}
                          />
                          <span className="text-sm">
                            {m.products.create.fields.allowNegativeStock}
                          </span>
                        </label>

                        <label
                          className="flex cursor-pointer items-center gap-3 rounded-md border p-3"
                          htmlFor="product-offline-sale"
                        >
                          <Checkbox
                            checked={allowOfflineSale}
                            id="product-offline-sale"
                            name="allowOfflineSale"
                            onCheckedChange={(checked) => {
                              setAllowOfflineSale(checked === true);
                              markChanged("allowOfflineSale");
                            }}
                          />
                          <span className="text-sm">
                            {m.products.create.fields.allowOfflineSale}
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="product-variant-name">
                      {m.products.create.fields.variantName}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.variantName)}
                      defaultValue={initialProduct?.sku.variantName ?? ""}
                      id="product-variant-name"
                      maxLength={160}
                      name="variantName"
                      placeholder={m.products.create.placeholders.variantName}
                    />
                    <FieldError message={getErrorMessage("variantName")} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="product-unit">
                      {m.products.create.fields.unitOfMeasure}
                    </Label>
                    <Select
                      name="unitOfMeasure"
                      onValueChange={(value) => {
                        setUnitOfMeasure(value);
                        markChanged("unitOfMeasure");
                      }}
                      value={unitOfMeasure}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.unitOfMeasure)}
                        id="product-unit"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="piece">
                          {m.products.create.unitOptions.piece}
                        </SelectItem>
                        <SelectItem value="box">
                          {m.products.create.unitOptions.box}
                        </SelectItem>
                        <SelectItem value="bottle">
                          {m.products.create.unitOptions.bottle}
                        </SelectItem>
                        <SelectItem value="pack">
                          {m.products.create.unitOptions.pack}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError message={getErrorMessage("unitOfMeasure")} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <aside className="grid self-start gap-5 lg:sticky lg:top-20">
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-5 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="product-status">
                      {m.products.create.fields.status}
                    </Label>
                    <Select
                      name="status"
                      onValueChange={(value) => {
                        setStatus(value as TenantProductStatus);
                        markChanged("status");
                      }}
                      value={status}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.status)}
                        id="product-status"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          {m.products.statusLabels.active}
                        </SelectItem>
                        <SelectItem value="inactive">
                          {m.products.statusLabels.inactive}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError message={getErrorMessage("status")} />
                  </div>
                </CardContent>
              </Card>

              <Dialog
                onOpenChange={(open) => {
                  if (open) {
                    openBranchDialog();
                  } else {
                    setBranchDialogOpen(false);
                  }
                }}
                open={branchDialogOpen}
              >
                <Card className="gap-0 rounded-lg py-0 shadow-none">
                  <CardContent className="grid gap-3 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {m.products.create.fields.publishBranches}
                      </p>
                      {!branchLoadFailed && branches.length > 0 ? (
                        <Button
                          aria-label={m.products.create.managePublishing}
                          onClick={openBranchDialog}
                          size="icon-sm"
                          title={m.products.create.managePublishing}
                          type="button"
                          variant="ghost"
                        >
                          <Icon
                            aria-hidden
                            icon={SlidersHorizontal}
                            size={14}
                          />
                        </Button>
                      ) : null}
                    </div>

                    {branchLoadFailed ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                        {m.common.requestFailed}
                      </p>
                    ) : branches.length === 0 ? (
                      <p className="rounded-md border px-3 py-2.5 text-sm text-muted-foreground">
                        {m.branches.list.empty}
                      </p>
                    ) : (
                      <button
                        className="flex w-full items-center gap-2 rounded-md py-1 text-left text-sm transition-colors hover:text-foreground"
                        onClick={openBranchDialog}
                        type="button"
                      >
                        <Icon
                          aria-hidden
                          className="shrink-0 text-muted-foreground"
                          icon={Store}
                          size={15}
                        />
                        <span className="truncate font-medium">
                          {allBranchesSelected
                            ? m.common.allBranches
                            : selectedBranchCopy}
                        </span>
                      </button>
                    )}

                    <FieldError message={getErrorMessage("branchSettings")} />
                  </CardContent>
                </Card>

                <DialogContent className="h-[min(620px,calc(100vh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
                  <DialogHeader className="border-b px-5 py-4 pr-12">
                    <DialogTitle className="text-base">
                      {m.products.create.managePublishing}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {m.products.create.branchDialogDescription}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="min-h-0 overflow-y-auto px-5 py-4">
                    <div className="relative mb-4">
                      <Icon
                        aria-hidden
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        icon={Search}
                        size={15}
                      />
                      <Input
                        aria-label={m.products.create.branchSearchPlaceholder}
                        className="pl-9"
                        onChange={(event) =>
                          setBranchSearch(event.target.value)
                        }
                        placeholder={m.products.create.branchSearchPlaceholder}
                        value={branchSearch}
                      />
                    </div>

                    <div className="overflow-hidden rounded-lg border">
                      <label
                        className="flex cursor-pointer items-center justify-between gap-3 bg-muted/50 px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                        htmlFor="product-all-branches"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon
                            aria-hidden
                            className="shrink-0 text-muted-foreground"
                            icon={Store}
                            size={15}
                          />
                          <span className="truncate">
                            {m.common.allBranches}
                          </span>
                        </span>
                        <Checkbox
                          checked={draftBranchSelectionState}
                          id="product-all-branches"
                          onCheckedChange={handleAllBranchesChange}
                        />
                      </label>

                      <div className="max-h-[360px] overflow-y-auto">
                        {filteredBranches.length > 0 ? (
                          filteredBranches.map((branch) => (
                            <label
                              className="flex cursor-pointer items-center justify-between gap-3 border-t px-3 py-3 text-sm transition-colors hover:bg-muted/40"
                              htmlFor={`product-branch-${branch.id}`}
                              key={branch.id}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {branch.name}
                                </span>
                                {branch.address ? (
                                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {branch.address}
                                  </span>
                                ) : null}
                              </span>
                              <Checkbox
                                checked={!draftExcludedBranchIds.has(branch.id)}
                                id={`product-branch-${branch.id}`}
                                onCheckedChange={(checked) =>
                                  handleBranchChange(branch.id, checked)
                                }
                              />
                            </label>
                          ))
                        ) : (
                          <p className="border-t px-3 py-8 text-center text-sm text-muted-foreground">
                            {m.products.create.noMatchingBranches}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="flex-row items-center justify-between border-t px-5 py-3">
                    <p className="text-xs text-muted-foreground">
                      {m.products.create.selectedBranchCount
                        .replace("{selected}", String(draftSelectedBranchCount))
                        .replace("{total}", String(branches.length))}
                    </p>
                    <div className="flex items-center gap-2">
                      <DialogClose asChild>
                        <Button type="button" variant="outline">
                          {m.common.cancel}
                        </Button>
                      </DialogClose>
                      <Button
                        disabled={draftSelectedBranchCount === 0}
                        onClick={confirmBranchSelection}
                        type="button"
                      >
                        {m.products.create.confirmBranchSelection}
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="grid gap-4 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="product-brand">
                      {m.products.create.fields.brand}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors.brand)}
                      defaultValue={initialProduct?.brand ?? ""}
                      id="product-brand"
                      maxLength={120}
                      name="brand"
                      placeholder={m.products.create.placeholders.brand}
                    />
                    <FieldError message={getErrorMessage("brand")} />
                  </div>

                  <div className="grid gap-2">
                    <Label>{m.products.create.fields.tags}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          aria-invalid={Boolean(errors.tags)}
                          className="h-auto min-h-9 w-full justify-start px-2 py-1.5 font-normal"
                          type="button"
                          variant="outline"
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {tags.map((tag) => (
                              <span
                                className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                                key={tag}
                              >
                                {tag}
                              </span>
                            ))}
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">
                              <Icon aria-hidden icon={Plus} size={12} />
                              {m.products.create.addTags}
                            </span>
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-(--radix-popover-trigger-width) p-0"
                      >
                        <div className="flex items-center border-b px-3">
                          <Icon
                            aria-hidden
                            className="shrink-0 text-muted-foreground"
                            icon={Search}
                            size={14}
                          />
                          <Input
                            aria-label={m.products.create.tagSearchPlaceholder}
                            className="h-10 border-0 px-2 shadow-none focus-visible:ring-0"
                            id="product-tags"
                            onChange={(event) => {
                              setTagInput(event.target.value);
                              markChanged("tags");
                            }}
                            onKeyDown={handleTagKeyDown}
                            placeholder={m.products.create.tagSearchPlaceholder}
                            value={tagInput}
                          />
                        </div>

                        <div className="max-h-64 overflow-y-auto p-1">
                          {tagInput.trim() &&
                          !tags.some(
                            (tag) =>
                              tag.toLowerCase() ===
                              tagInput.trim().toLowerCase(),
                          ) ? (
                            <button
                              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                              onClick={() => addTags(tagInput)}
                              type="button"
                            >
                              <Icon
                                aria-hidden
                                className="text-muted-foreground"
                                icon={Plus}
                                size={14}
                              />
                              <span className="truncate">
                                {m.products.create.addTag.replace(
                                  "{tag}",
                                  tagInput.trim(),
                                )}
                              </span>
                            </button>
                          ) : null}

                          {tags.length > 0 ? (
                            tags.map((tag) => (
                              <div
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                                key={tag}
                              >
                                <span className="truncate">{tag}</span>
                                <button
                                  aria-label={`${m.products.create.removeTag} ${tag}`}
                                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                  onClick={() => removeTag(tag)}
                                  type="button"
                                >
                                  <Icon aria-hidden icon={X} size={13} />
                                </button>
                              </div>
                            ))
                          ) : !tagInput.trim() ? (
                            <p className="px-2 py-5 text-center text-xs text-muted-foreground">
                              {m.products.create.tagEmpty}
                            </p>
                          ) : null}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FieldError message={getErrorMessage("tags")} />
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>

          <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end px-1">
            <div className="pointer-events-auto grid w-full grid-cols-2 items-center gap-1.5 rounded-xl border border-border/80 bg-background/90 p-1.5 shadow-[0_14px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:w-auto">
              <Button
                asChild
                className="rounded-lg"
                size="sm"
                type="button"
                variant="ghost"
              >
                <Link href={webAdminRoutes.tenant.products}>
                  {m.common.cancel}
                </Link>
              </Button>
              <Button
                aria-busy={saving}
                className="min-w-28 gap-2 rounded-lg"
                disabled={
                  saving ||
                  formUnavailable ||
                  (Boolean(categoryId) &&
                    categoryMetafieldsLoadState !== "loaded")
                }
                size="sm"
                type="submit"
              >
                <Icon
                  aria-hidden
                  className={saving ? "animate-spin" : undefined}
                  icon={saving ? LoaderCircle : Check}
                  size={14}
                />
                {saving
                  ? m.common.saving
                  : isEditMode
                    ? m.products.edit.saveProduct
                    : m.products.create.saveProduct}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
