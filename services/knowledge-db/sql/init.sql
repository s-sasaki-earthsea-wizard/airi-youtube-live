-- Enable pgvector extension for vector similarity search
ALTER SYSTEM SET vectors.pgvector_compatibility=on;

DROP EXTENSION IF EXISTS vectors;
CREATE EXTENSION vectors;
