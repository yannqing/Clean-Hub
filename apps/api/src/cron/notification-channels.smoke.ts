import assert from "node:assert/strict";
import { notificationDeliveryChannels } from "./email-delivery.js";

assert.deepEqual(notificationDeliveryChannels({ EMAIL_DELIVERY_DISABLED: "true", PUSH_DELIVERY_DISABLED: "false" }),
  { email: false, push: true, overdue: true }, "disabling SMTP must not stop FCM or ready/overdue notifications");
assert.deepEqual(notificationDeliveryChannels({ EMAIL_DELIVERY_DISABLED: "false", PUSH_DELIVERY_DISABLED: "true", EMAIL_OVERDUE_TICKET_DISABLED: "true" }),
  { email: true, push: false, overdue: false });
console.log("Independent notification channels smoke passed.");
