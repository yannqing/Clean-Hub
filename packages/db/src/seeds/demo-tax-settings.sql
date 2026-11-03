-- Demo onboarding fiscal setup. Run inside the seed runner's transaction AFTER
-- all demo fixtures and seedDemoTaxTemplates. Never use this to onboard a real merchant.
-- Countries are fixed test fixtures, not guesses based on a merchant's currency.
-- All rates, components and price modes come from the current database template.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tenants t LEFT JOIN platform_tax_templates p ON p.country_code = t.country
    WHERE t.id IN ('01KRERJN800000000000000001','01KRERJN810000000000000002','01KRERJN820000000000000003')
      AND (p.id IS NULL OR p.currency_code IS NULL OR nullif(trim(p.tax_label),'') IS NULL OR NOT p.tax_enabled
        OR (SELECT count(*) FROM jsonb_array_elements(p.rates) r WHERE (r->>'isDefault')::boolean) <> 1)
  ) THEN
    RAISE EXCEPTION 'Demo country tax templates are incomplete. Complete/import them in SaaS platform settings, then rerun db:seed.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM branches b JOIN tenants t ON t.id=b.tenant_id JOIN platform_tax_templates p ON p.country_code=t.country
    WHERE t.id IN ('01KRERJN800000000000000001','01KRERJN810000000000000002','01KRERJN820000000000000003')
      AND b.deleted_at IS NULL AND b.default_currency <> p.currency_code
  ) THEN
    RAISE EXCEPTION 'Demo branch currency differs from the template. Seed will not reinterpret existing money.';
  END IF;
END $$;

INSERT INTO tenant_settings (id,tenant_id,default_currency)
SELECT CASE t.pressing_code
    WHEN 'CLEAN-001' THEN '01M4WJVXDXRSZZ50HFHQVDVZG4'
    WHEN 'CLEAN-002' THEN '01M4WJVXDXRSZZ50HFHQVDVZG5'
    ELSE '01M4WJVXDXRSZZ50HFHQVDVZG6' END,
  t.id,p.currency_code
FROM tenants t JOIN platform_tax_templates p ON p.country_code=t.country
WHERE t.id IN ('01KRERJN800000000000000001','01KRERJN810000000000000002','01KRERJN820000000000000003')
ON CONFLICT (tenant_id) DO UPDATE SET default_currency=EXCLUDED.default_currency,
  updated_at=now(),version=tenant_settings.version+1;

INSERT INTO pos_channel_settings
  (id,tenant_id,tax_enabled,default_tax_rate,prices_include_tax,tax_registration_number,tax_label,
   default_tax_components,tax_template_country_code,tax_template_version)
SELECT CASE t.pressing_code
    WHEN 'CLEAN-001' THEN '01M4WJVXDXRSZZ50HFHQVDVZG7'
    WHEN 'CLEAN-002' THEN '01M4WJVXDXRSZZ50HFHQVDVZG8'
    ELSE '01M4WJVXDXRSZZ50HFHQVDVZG9' END,
  t.id,p.tax_enabled,(r->>'rate')::numeric,p.prices_include_tax,
  'TEST-' || t.country || '-' || t.pressing_code,p.tax_label,r->'components',p.country_code,p.version
FROM tenants t JOIN platform_tax_templates p ON p.country_code=t.country
CROSS JOIN LATERAL jsonb_array_elements(p.rates) r
WHERE t.id IN ('01KRERJN800000000000000001','01KRERJN810000000000000002','01KRERJN820000000000000003')
  AND (r->>'isDefault')::boolean
ON CONFLICT (tenant_id) DO UPDATE SET
  tax_enabled=EXCLUDED.tax_enabled,default_tax_rate=EXCLUDED.default_tax_rate,
  prices_include_tax=EXCLUDED.prices_include_tax,tax_label=EXCLUDED.tax_label,
  default_tax_components=EXCLUDED.default_tax_components,
  tax_template_country_code=EXCLUDED.tax_template_country_code,tax_template_version=EXCLUDED.tax_template_version,
  tax_registration_number=coalesce(nullif(trim(pos_channel_settings.tax_registration_number),''),EXCLUDED.tax_registration_number),
  updated_at=now(),version=pos_channel_settings.version+1;

INSERT INTO tax_rates (id,tenant_id,name,rate,template_rate_key,display_order)
SELECT ids.id,t.id,r->>'name',(r->>'rate')::numeric,coalesce(r->>'key','legacy-' || (n-1)),(n-1)::integer
FROM tenants t JOIN platform_tax_templates p ON p.country_code=t.country
CROSS JOIN LATERAL jsonb_array_elements(p.rates) WITH ORDINALITY rates(r,n)
JOIN demo_tax_class_ids ids ON ids.tenant_id=t.id AND ids.rate_key=coalesce(r->>'key','legacy-' || (n-1))
ON CONFLICT (tenant_id,lower(name)) WHERE deleted_at IS NULL DO UPDATE SET
  rate=EXCLUDED.rate,template_rate_key=EXCLUDED.template_rate_key,display_order=EXCLUDED.display_order,
  updated_at=now(),version=tax_rates.version+1;
