export const Z_CODE_COLOR_ALIASES = {
  yellow: "#fcc01a",
  orange: "#ff6319",
  red: "#ee352e",
  deepGreen: "#00933c",
  blue: "#0039a6",
  purple: "#b933ad",
  brown: "#996633",
  green: "#6cbe45",
  steel: "#808183",
  white: "#ffffff",
} as const;

export type ZCodeColorAlias = keyof typeof Z_CODE_COLOR_ALIASES;

export const Z_CODE_PARENT_COLORS = {
  Z55: Z_CODE_COLOR_ALIASES.yellow,
  Z56: Z_CODE_COLOR_ALIASES.orange,
  Z57: Z_CODE_COLOR_ALIASES.red,
  Z58: Z_CODE_COLOR_ALIASES.green,
  Z59: Z_CODE_COLOR_ALIASES.deepGreen,
  Z60: Z_CODE_COLOR_ALIASES.blue,
  Z62: Z_CODE_COLOR_ALIASES.purple,
  Z63: Z_CODE_COLOR_ALIASES.brown,
  Z64: Z_CODE_COLOR_ALIASES.green,
  Z65: Z_CODE_COLOR_ALIASES.steel,
  Z75: Z_CODE_COLOR_ALIASES.white,
} as const;

export type ZCodeParentColorKey = keyof typeof Z_CODE_PARENT_COLORS;

export function normalizeZCodeParent(input: string) {
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("Z")) {
    return cleaned.slice(0, 3) as ZCodeParentColorKey;
  }
  return `Z${cleaned.slice(0, 2)}` as ZCodeParentColorKey;
}

export function getZCodeParentColor(input: string) {
  const parent = normalizeZCodeParent(input);
  if (!parent) return null;
  return Z_CODE_PARENT_COLORS[parent] || null;
}

export function usesLightTextOnZCodeColor(color: string) {
  const lightTextColors: string[] = [
    Z_CODE_COLOR_ALIASES.blue,
    Z_CODE_COLOR_ALIASES.purple,
    Z_CODE_COLOR_ALIASES.deepGreen,
    Z_CODE_COLOR_ALIASES.red,
  ];
  return lightTextColors.includes(color.toLowerCase());
}
