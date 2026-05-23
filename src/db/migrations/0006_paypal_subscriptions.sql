ALTER TABLE "subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paypal_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paypal_plan_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_paypal_sub_idx" ON "subscriptions" USING btree ("paypal_subscription_id");