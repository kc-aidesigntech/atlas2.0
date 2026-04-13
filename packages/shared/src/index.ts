export const ATLAS_APP_NAME = "ATLAS";

export const atlasPlatforms = ["web", "ios", "android"] as const;
export type AtlasPlatform = (typeof atlasPlatforms)[number];

export * from "./atlas2026/contracts";
export * from "./atlas2026/partnerServiceCapacity";
export * from "./atlas2026/theme";
export * from "./atlas2026/routing";
export * from "./atlas2026/zCodeColors";
export * from "./supabase/contracts";
export * from "./supabase/client";
export * from "./supabase/atlasAppApi";
export * from "./supabase/navigatorApi";
export * from "./supabase/partnerServiceCapacityApi";
