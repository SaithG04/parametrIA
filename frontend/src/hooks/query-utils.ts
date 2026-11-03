import type { QueryClient } from "@tanstack/react-query";

export function invalidate(client: QueryClient, keys: readonly (readonly unknown[])[]) {
  keys.forEach((key) => void client.invalidateQueries({ queryKey: [...key] }));
}
