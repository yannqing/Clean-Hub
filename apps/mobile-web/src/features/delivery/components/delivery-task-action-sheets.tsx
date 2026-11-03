"use client";

import type { FormEvent, PointerEvent, RefObject } from "react";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@cleanhub/ui";
import {
  AlertTriangle,
  Camera,
  ImageIcon,
  Loader2,
  PackageCheck,
  UserRound,
} from "lucide-react";

import type { UploadableMedia } from "../lib/media-upload";
import type {
  DeliveryProofType,
  DeliveryTaskDetail,
} from "../types";

export type DeliverySheet = "exception" | "proof" | "signature" | null;

export type DeliveryCapturedProofPhoto = {
  media: UploadableMedia;
  capturedAt: string;
  previewUrl: string;
};

type DeliveryTaskActionSheetsProps = {
  activeAction: string | null;
  exceptionOpen: boolean;
  exceptionReason: string;
  hasSignature: boolean;
  proofOpen: boolean;
  proofPhoto: DeliveryCapturedProofPhoto | null;
  proofTypeLabelKeys: Record<DeliveryProofType, TranslationKey>;
  selectedTask: DeliveryTaskDetail | null;
  signatureCanvasRef: RefObject<HTMLCanvasElement | null>;
  signatureOpen: boolean;
  signedByName: string;
  onBeginSignature: (event: PointerEvent<HTMLCanvasElement>) => void;
  onCapturePhoto: (source: "camera" | "gallery") => void;
  onClearSignature: () => void;
  onDrawSignature: (event: PointerEvent<HTMLCanvasElement>) => void;
  onEndSignature: (event: PointerEvent<HTMLCanvasElement>) => void;
  onExceptionOpenChange: (open: boolean) => void;
  onExceptionReasonChange: (value: string) => void;
  onExceptionSubmit: () => void;
  onProofOpenChange: (open: boolean) => void;
  onProofSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignatureOpenChange: (open: boolean) => void;
  onSignatureSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSignedByNameChange: (value: string) => void;
};

export function DeliveryTaskActionSheets({
  activeAction,
  exceptionOpen,
  exceptionReason,
  hasSignature,
  proofOpen,
  proofPhoto,
  proofTypeLabelKeys,
  selectedTask,
  signatureCanvasRef,
  signatureOpen,
  signedByName,
  onBeginSignature,
  onCapturePhoto,
  onClearSignature,
  onDrawSignature,
  onEndSignature,
  onExceptionOpenChange,
  onExceptionReasonChange,
  onExceptionSubmit,
  onProofOpenChange,
  onProofSubmit,
  onSignatureOpenChange,
  onSignatureSubmit,
  onSignedByNameChange,
}: DeliveryTaskActionSheetsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Sheet open={exceptionOpen} onOpenChange={onExceptionOpenChange}>
        <SheetContent className="max-h-[72dvh] p-0">
          <form
            className="flex min-h-full flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              onExceptionSubmit();
            }}
          >
            <div className="space-y-4 px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{t("delivery.exception.title")}</SheetTitle>
                <SheetDescription>{t("delivery.exception.description")}</SheetDescription>
              </SheetHeader>
              <div className="space-y-2">
                <Label htmlFor="exception-reason">
                  {t("delivery.exception.reason")}
                </Label>
                <Textarea
                  className="min-h-28 text-base"
                  id="exception-reason"
                  value={exceptionReason}
                  onChange={(event) => onExceptionReasonChange(event.target.value)}
                />
              </div>
            </div>
            <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                className="h-12 w-full"
                disabled={Boolean(activeAction) || !exceptionReason.trim()}
                type="submit"
                variant="destructive"
              >
                {activeAction === "exception" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-4" aria-hidden="true" />
                )}
                {t("delivery.exception.submit")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={proofOpen} onOpenChange={onProofOpenChange}>
        <SheetContent className="max-h-[82dvh] p-0">
          <form className="flex min-h-full flex-col" onSubmit={onProofSubmit}>
            <div className="space-y-4 px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{t("delivery.proof.title")}</SheetTitle>
                <SheetDescription>{t("delivery.proof.description")}</SheetDescription>
              </SheetHeader>

              {selectedTask ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium text-slate-950">
                    {t("delivery.proof.forTask")}
                  </span>{" "}
                  {t(proofTypeLabelKeys[selectedTask.type])}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-12"
                    disabled={Boolean(activeAction)}
                    type="button"
                    variant="secondary"
                    onClick={() => onCapturePhoto("camera")}
                  >
                    {activeAction === "camera" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera className="size-4" aria-hidden="true" />
                    )}
                    {proofPhoto
                      ? t("delivery.proof.retake")
                      : t("delivery.proof.capture")}
                  </Button>
                  <Button
                    className="h-12"
                    disabled={Boolean(activeAction)}
                    type="button"
                    variant="secondary"
                    onClick={() => onCapturePhoto("gallery")}
                  >
                    {activeAction === "gallery" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="size-4" aria-hidden="true" />
                    )}
                    {t("delivery.proof.gallery")}
                  </Button>
                </div>

                {proofPhoto ? (
                  <div className="overflow-hidden rounded-md border border-emerald-200 bg-emerald-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Local blob previews cannot use Next image optimization. */}
                    <img
                      alt={t("delivery.proof.previewAlt")}
                      className="aspect-[4/3] w-full object-cover"
                      src={proofPhoto.previewUrl}
                    />
                    <p className="px-3 py-2 text-sm text-emerald-800">
                      {t("delivery.proof.captured")}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                    {t("delivery.proof.empty")}
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                className="h-12 w-full"
                disabled={Boolean(activeAction) || !proofPhoto}
                type="submit"
              >
                {activeAction === "proof" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <PackageCheck className="size-4" aria-hidden="true" />
                )}
                {t("delivery.proof.submit")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={signatureOpen} onOpenChange={onSignatureOpenChange}>
        <SheetContent className="max-h-[86dvh] p-0">
          <form className="flex min-h-full flex-col" onSubmit={onSignatureSubmit}>
            <div className="space-y-4 px-5 pb-4 pt-2">
              <SheetHeader className="pr-8 text-left">
                <SheetTitle>{t("delivery.signature.title")}</SheetTitle>
                <SheetDescription>{t("delivery.signature.description")}</SheetDescription>
              </SheetHeader>

              <div className="space-y-2">
                <Label htmlFor="signed-by">{t("delivery.signature.signer")}</Label>
                <Input
                  className="h-12 text-base"
                  id="signed-by"
                  value={signedByName}
                  onChange={(event) => onSignedByNameChange(event.target.value)}
                />
              </div>

              <canvas
                aria-label={t("delivery.signature.canvasLabel")}
                className="h-44 w-full touch-none rounded-md border border-slate-300 bg-white"
                height={260}
                ref={signatureCanvasRef}
                width={680}
                onPointerCancel={onEndSignature}
                onPointerDown={onBeginSignature}
                onPointerLeave={onEndSignature}
                onPointerMove={onDrawSignature}
                onPointerUp={onEndSignature}
              />
            </div>
            <div className="sticky bottom-0 mt-auto grid grid-cols-2 gap-2 border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Button
                className="h-12"
                disabled={!hasSignature || Boolean(activeAction)}
                type="button"
                variant="secondary"
                onClick={onClearSignature}
              >
                {t("delivery.signature.clear")}
              </Button>
              <Button className="h-12" disabled={Boolean(activeAction)} type="submit">
                {activeAction === "signature" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserRound className="size-4" aria-hidden="true" />
                )}
                {t("delivery.signature.submit")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
