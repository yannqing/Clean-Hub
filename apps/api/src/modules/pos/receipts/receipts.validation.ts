import { z } from "zod";

const idempotencyKeySchema = z.string().trim().min(1).max(120);

export const deliverPosReceiptBodySchema = z
  .object({
    channel: z.enum(["print", "email", "sms", "none"]),
    destination: z.string().trim().max(320).optional(),
    idempotencyKey: idempotencyKeySchema,
    printStatus: z.enum(["sent", "failed"]).optional(),
    failureReason: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.channel === "email") {
      if (!value.destination || !z.string().email().safeParse(value.destination).success) {
        context.addIssue({
          code: "custom",
          path: ["destination"],
          message: "A valid email destination is required.",
        });
      }
    }
    if (
      value.channel === "sms" &&
      (!value.destination || !/^\+?[0-9][0-9 ()-]{5,24}$/.test(value.destination))
    ) {
      context.addIssue({
        code: "custom",
        path: ["destination"],
        message: "A valid SMS phone number is required.",
      });
    }
    if (value.channel === "print" && !value.printStatus) {
      context.addIssue({
        code: "custom",
        path: ["printStatus"],
        message: "Print status is required for a print receipt delivery.",
      });
    }
  });
