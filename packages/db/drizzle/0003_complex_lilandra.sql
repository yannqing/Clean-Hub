ALTER TABLE "appointments" ADD COLUMN "delivery_task_id" varchar(26);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "accepted_by" varchar(26);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancelled_by" varchar(26);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "done_by" varchar(26);--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "appointment_id" varchar(26);--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "dispatched_by" varchar(26);--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD COLUMN "cancelled_by" varchar(26);--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_delivery_task_id_delivery_tasks_id_fk" FOREIGN KEY ("delivery_task_id") REFERENCES "public"."delivery_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_delivery_task_id_idx" ON "appointments" USING btree ("delivery_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_tasks_active_appointment_unique" ON "delivery_tasks" USING btree ("tenant_id","appointment_id") WHERE "delivery_tasks"."appointment_id" is not null and "delivery_tasks"."deleted_at" is null and "delivery_tasks"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "delivery_tasks_appointment_id_idx" ON "delivery_tasks" USING btree ("appointment_id");
