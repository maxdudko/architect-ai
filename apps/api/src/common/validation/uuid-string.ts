/** Layout-only UUID check. @IsUUID() defaults to RFC v4 and rejects seed plan ids. */
export const UUID_STRING_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
