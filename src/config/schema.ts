import { z } from "zod";

const connectionEntrySchema = z.object({
  description: z.string().optional(),
  uri_env: z.string(),
  read_only: z.boolean().optional(),
  max_documents_per_query: z.number().int().positive().optional(),
  allowed_databases: z.array(z.string()).optional(),
});

export const configSchema = z.object({
  default_connection: z.string(),
  read_only: z.boolean().default(false),
  index_check: z.boolean().default(false),
  disable_server_side_js: z.boolean().default(true),
  max_documents_per_query: z.number().int().positive().default(100),
  max_payload_bytes: z.number().int().positive().default(16_777_216),
  connection_filter: z.string().default(""),
  confirmation_required_tools: z.array(z.string()).default([]),
  connections: z.record(connectionEntrySchema),
  assistant: z
    .object({
      enabled: z.boolean().default(true),
      base_url: z.string().url().default("https://knowledge.mongodb.com/api/v1/"),
    })
    .default({}),
  atlas: z
    .object({
      enabled: z.boolean().default(false),
      public_key_env: z.string().default("ATLAS_PUBLIC_KEY"),
      private_key_env: z.string().default("ATLAS_PRIVATE_KEY"),
      default_project_id: z.string().optional(),
    })
    .default({}),
});

export type AppConfig = z.infer<typeof configSchema>;
export type ConnectionEntry = z.infer<typeof connectionEntrySchema>;

export type EffectiveConnectionSettings = {
  name: string;
  description?: string;
  readOnly: boolean;
  indexCheck: boolean;
  disableServerSideJs: boolean;
  maxDocumentsPerQuery: number;
  maxPayloadBytes: number;
  allowedDatabases?: string[];
};
