CREATE TABLE "platform_service_articles" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"group_id" varchar(26) NOT NULL,
	"names" jsonb NOT NULL,
	"descriptions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_service_articles_sort_check" CHECK ("platform_service_articles"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "platform_service_item_groups" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"item_type" varchar(16) NOT NULL,
	"names" jsonb NOT NULL,
	"descriptions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(26),
	CONSTRAINT "platform_service_item_groups_type_check" CHECK ("platform_service_item_groups"."item_type" in ('cloth','shoe','carpet','car')),
	CONSTRAINT "platform_service_item_groups_sort_check" CHECK ("platform_service_item_groups"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "service_item_catalog" jsonb;--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "item_type_name" varchar(80);--> statement-breakpoint
ALTER TABLE "ticket_items" ADD COLUMN "catalog_item_id" varchar(26);--> statement-breakpoint
ALTER TABLE "platform_service_articles" ADD CONSTRAINT "platform_service_articles_group_id_platform_service_item_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."platform_service_item_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_service_articles_group_idx" ON "platform_service_articles" USING btree ("group_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_service_item_groups_type_unique" ON "platform_service_item_groups" USING btree ("item_type");--> statement-breakpoint
ALTER TABLE "ticket_items" ADD CONSTRAINT "ticket_items_catalog_item_id_platform_service_articles_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."platform_service_articles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Database-owned initial catalog. Existing tenants retain nullable compatibility selections; no historical ticket is rewritten.
--> statement-breakpoint
INSERT INTO platform_service_item_groups (id,item_type,names,descriptions,sort_order) VALUES ('01M59TRZFBCJWCNT1PTA9G18TS','cloth','{"en": "Clothing", "fr": "Vêtements", "zh-CN": "衣物"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,0);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW39','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Shirt", "fr": "Chemise", "zh-CN": "衬衫"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,0);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3A','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "T-shirt", "fr": "T-shirt", "zh-CN": "T恤"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,1);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3B','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Trousers", "fr": "Pantalon", "zh-CN": "裤子"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,2);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3C','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Dress", "fr": "Robe", "zh-CN": "连衣裙"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,3);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3D','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Suit", "fr": "Costume", "zh-CN": "西装"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,4);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3E','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Coat", "fr": "Manteau", "zh-CN": "外套"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,5);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3F','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Down jacket", "fr": "Doudoune", "zh-CN": "羽绒服"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,6);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3G','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Bed sheet", "fr": "Drap", "zh-CN": "床单"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,7);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3H','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Duvet cover", "fr": "Housse de couette", "zh-CN": "被套"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,8);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3J','01M59TRZFBCJWCNT1PTA9G18TS','{"en": "Curtains", "fr": "Rideaux", "zh-CN": "窗帘"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,9);
--> statement-breakpoint
INSERT INTO platform_service_item_groups (id,item_type,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3K','shoe','{"en": "Footwear", "fr": "Chaussures", "zh-CN": "鞋类"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,1);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3M','01M59TRZFCV6KDE6WM8Q1AXW3K','{"en": "Trainers", "fr": "Baskets", "zh-CN": "运动鞋"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,0);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3N','01M59TRZFCV6KDE6WM8Q1AXW3K','{"en": "Leather shoes", "fr": "Chaussures en cuir", "zh-CN": "皮鞋"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,1);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3P','01M59TRZFCV6KDE6WM8Q1AXW3K','{"en": "Boots", "fr": "Bottes", "zh-CN": "靴子"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,2);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3Q','01M59TRZFCV6KDE6WM8Q1AXW3K','{"en": "Sandals", "fr": "Sandales", "zh-CN": "凉鞋"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,3);
--> statement-breakpoint
INSERT INTO platform_service_item_groups (id,item_type,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3R','carpet','{"en": "Carpets", "fr": "Tapis", "zh-CN": "地毯"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,2);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3S','01M59TRZFCV6KDE6WM8Q1AXW3R','{"en": "Small rug", "fr": "Petit tapis", "zh-CN": "小地毯"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,0);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3T','01M59TRZFCV6KDE6WM8Q1AXW3R','{"en": "Medium carpet", "fr": "Tapis moyen", "zh-CN": "中型地毯"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,1);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3V','01M59TRZFCV6KDE6WM8Q1AXW3R','{"en": "Large carpet", "fr": "Grand tapis", "zh-CN": "大型地毯"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,2);
--> statement-breakpoint
INSERT INTO platform_service_item_groups (id,item_type,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3W','car','{"en": "Vehicles", "fr": "Véhicules", "zh-CN": "车辆"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,3);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3X','01M59TRZFCV6KDE6WM8Q1AXW3W','{"en": "Saloon car", "fr": "Berline", "zh-CN": "轿车"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,0);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3Y','01M59TRZFCV6KDE6WM8Q1AXW3W','{"en": "SUV", "fr": "SUV", "zh-CN": "SUV"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,1);
--> statement-breakpoint
INSERT INTO platform_service_articles (id,group_id,names,descriptions,sort_order) VALUES ('01M59TRZFCV6KDE6WM8Q1AXW3Z','01M59TRZFCV6KDE6WM8Q1AXW3W','{"en": "Van", "fr": "Fourgon", "zh-CN": "面包车"}'::jsonb,'{"en": "", "fr": "", "zh-CN": ""}'::jsonb,2);
--> statement-breakpoint
ALTER TABLE public.platform_service_item_groups ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.platform_service_item_groups FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY cleanhub_catalog_read ON public.platform_service_item_groups FOR SELECT TO PUBLIC USING (public.cleanhub_rls_bypass_enabled() OR public.cleanhub_current_tenant_id() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation ON public.platform_service_item_groups FOR ALL TO PUBLIC USING (public.cleanhub_rls_bypass_enabled()) WITH CHECK (public.cleanhub_rls_bypass_enabled());
--> statement-breakpoint
ALTER TABLE public.platform_service_articles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.platform_service_articles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY cleanhub_catalog_read ON public.platform_service_articles FOR SELECT TO PUBLIC USING (public.cleanhub_rls_bypass_enabled() OR public.cleanhub_current_tenant_id() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY cleanhub_tenant_isolation ON public.platform_service_articles FOR ALL TO PUBLIC USING (public.cleanhub_rls_bypass_enabled()) WITH CHECK (public.cleanhub_rls_bypass_enabled());
