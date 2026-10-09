ALTER TABLE "orders" ADD CONSTRAINT "orders_settlement_terms_check" CHECK ((
        "orders"."settlement_intent" = 'pay_now'
        and "orders"."balance_due_at" is null
        and "orders"."unpaid_reason" is null
      ) or (
        "orders"."settlement_intent" <> 'pay_now'
        and "orders"."customer_id" is not null
        and "orders"."balance_due_at" is not null
        and nullif(btrim("orders"."unpaid_reason"), '') is not null
      ));