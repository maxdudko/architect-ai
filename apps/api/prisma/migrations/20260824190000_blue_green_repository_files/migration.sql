-- Allow two indexing generations to coexist by scoping file uniqueness to a run.
DROP INDEX "repository_files_repository_id_path_key";

CREATE UNIQUE INDEX "repository_files_repository_run_path_key" ON "repository_files"("repositoryId", "indexingRunId", "path");
