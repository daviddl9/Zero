CREATE TABLE "mail0_skill_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_reference_skill_id_name_unique" UNIQUE("skill_id","name")
);
--> statement-breakpoint
ALTER TABLE "mail0_skill_reference" ADD CONSTRAINT "mail0_skill_reference_skill_id_mail0_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."mail0_skill"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "skill_reference_skill_id_idx" ON "mail0_skill_reference" USING btree ("skill_id");
