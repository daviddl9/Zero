-- Enable pgvector extension for vector similarity search (required for embedding column)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "mail0_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"category" text NOT NULL,
	"recipient_email" text,
	"recipient_domain" text,
	"weight" real DEFAULT 1,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "mail0_workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connection_id" text,
	"name" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "mail0_workflow_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"thread_id" text,
	"status" text NOT NULL,
	"trigger_data" jsonb,
	"node_results" jsonb,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "mail0_memory" ADD CONSTRAINT "mail0_memory_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_memory" ADD CONSTRAINT "mail0_memory_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_skill_reference" ADD CONSTRAINT "mail0_skill_reference_skill_id_mail0_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."mail0_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_workflow" ADD CONSTRAINT "mail0_workflow_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_workflow" ADD CONSTRAINT "mail0_workflow_connection_id_mail0_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."mail0_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_workflow_execution" ADD CONSTRAINT "mail0_workflow_execution_workflow_id_mail0_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."mail0_workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_user_id_idx" ON "mail0_memory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_connection_id_idx" ON "mail0_memory" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "memory_recipient_domain_idx" ON "mail0_memory" USING btree ("recipient_domain");--> statement-breakpoint
CREATE INDEX "memory_category_idx" ON "mail0_memory" USING btree ("category");--> statement-breakpoint
CREATE INDEX "memory_created_at_idx" ON "mail0_memory" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "skill_reference_skill_id_idx" ON "mail0_skill_reference" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "workflow_user_id_idx" ON "mail0_workflow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workflow_connection_id_idx" ON "mail0_workflow" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "workflow_is_enabled_idx" ON "mail0_workflow" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "workflow_execution_workflow_id_idx" ON "mail0_workflow_execution" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_status_idx" ON "mail0_workflow_execution" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_execution_thread_id_idx" ON "mail0_workflow_execution" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "workflow_execution_started_at_idx" ON "mail0_workflow_execution" USING btree ("started_at");--> statement-breakpoint
-- Create HNSW index for fast vector similarity search on memory embeddings
CREATE INDEX "memory_embedding_hnsw_idx" ON "mail0_memory" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);