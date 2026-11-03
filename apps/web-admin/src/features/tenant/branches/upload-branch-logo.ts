import { uploadBranchLogoAction } from "./actions";

export type BranchLogoUploadResult =
  | { ok: true; objectKey: string }
  | { ok: false; reason: "missing" | "type" | "size" | "upload" };

export async function uploadBranchLogo(
  file: File,
): Promise<BranchLogoUploadResult> {
  const ticketResult = await uploadBranchLogoAction({
    contentType: file.type,
    sizeBytes: file.size,
  });

  if (!ticketResult.ok) {
    return ticketResult;
  }

  try {
    const response = await fetch(ticketResult.ticket.uploadUrl, {
      method: "PUT",
      headers: ticketResult.ticket.headers,
      body: file,
    });

    if (!response.ok) {
      return { ok: false, reason: "upload" };
    }
  } catch {
    return { ok: false, reason: "upload" };
  }

  return { ok: true, objectKey: ticketResult.ticket.objectKey };
}
