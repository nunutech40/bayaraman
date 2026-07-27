CREATE TABLE IF NOT EXISTS "buyer_refund_destinations" (
	"transaction_id" uuid NOT NULL,
	"participant_account_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"raw_account_value" text NOT NULL,
	"masked_account_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "buyer_refund_destinations_transaction_id_participant_account_id_pk" PRIMARY KEY("transaction_id","participant_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buyer_shipping_addresses" (
	"transaction_id" uuid NOT NULL,
	"participant_account_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"phone_snapshot" text NOT NULL,
	"address_line" text NOT NULL,
	"district" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "buyer_shipping_addresses_transaction_id_participant_account_id_pk" PRIMARY KEY("transaction_id","participant_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_payout_destinations" (
	"transaction_id" uuid NOT NULL,
	"participant_account_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"raw_account_value" text NOT NULL,
	"masked_account_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "seller_payout_destinations_transaction_id_participant_account_id_pk" PRIMARY KEY("transaction_id","participant_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_items" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"item_name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"condition" text NOT NULL,
	"quantity" integer NOT NULL,
	"photo_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buyer_refund_destinations" ADD CONSTRAINT "buyer_refund_destinations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buyer_refund_destinations" ADD CONSTRAINT "buyer_refund_destinations_participant_account_id_accounts_id_fk" FOREIGN KEY ("participant_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buyer_refund_destinations" ADD CONSTRAINT "buyer_refund_destinations_transaction_id_participant_account_id_transaction_participants_transaction_id_account_id_fk" FOREIGN KEY ("transaction_id","participant_account_id") REFERENCES "public"."transaction_participants"("transaction_id","account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buyer_shipping_addresses" ADD CONSTRAINT "buyer_shipping_addresses_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buyer_shipping_addresses" ADD CONSTRAINT "buyer_shipping_addresses_participant_account_id_accounts_id_fk" FOREIGN KEY ("participant_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "buyer_shipping_addresses" ADD CONSTRAINT "buyer_shipping_addresses_transaction_id_participant_account_id_transaction_participants_transaction_id_account_id_fk" FOREIGN KEY ("transaction_id","participant_account_id") REFERENCES "public"."transaction_participants"("transaction_id","account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_payout_destinations" ADD CONSTRAINT "seller_payout_destinations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_payout_destinations" ADD CONSTRAINT "seller_payout_destinations_participant_account_id_accounts_id_fk" FOREIGN KEY ("participant_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seller_payout_destinations" ADD CONSTRAINT "seller_payout_destinations_transaction_id_participant_account_id_transaction_participants_transaction_id_account_id_fk" FOREIGN KEY ("transaction_id","participant_account_id") REFERENCES "public"."transaction_participants"("transaction_id","account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_refund_destination_account_idx" ON "buyer_refund_destinations" USING btree ("participant_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_shipping_address_account_idx" ON "buyer_shipping_addresses" USING btree ("participant_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_payout_destination_account_idx" ON "seller_payout_destinations" USING btree ("participant_account_id");