// Pure mapping between the Face controls panel inputs and ControlSettings.
// DOM-free so it runs under plain Node.
import {
  CONTROL_SETTINGS_LIMITS,
  DEFAULT_CONTROL_SETTINGS,
  sanitizeControlSettings,
  type ControlSettings,
} from "./controlSettings.ts";

export type SliderField = keyof typeof CONTROL_SETTINGS_LIMITS;
export type ToggleField = "invertYaw" | "invertPitch";

export interface SliderAttributes {
  min: string;
  max: string;
  step: string;
}

export function sliderAttributes(field: SliderField): SliderAttributes {
  const { min, max, step } = CONTROL_SETTINGS_LIMITS[field];
  return { min: String(min), max: String(max), step: String(step) };
}

// Rounds away float noise such as 0.30000000000000004.
function roundToStep(value: number, field: SliderField): number {
  const { min, step } = CONTROL_SETTINGS_LIMITS[field];
  const snapped = min + Math.round((value - min) / step) * step;
  return Number(snapped.toFixed(6));
}

// A range input's string value → new settings, snapped to the step and
// clamped to the limits. Junk keeps the current value.
export function applySliderValue(
  settings: ControlSettings,
  field: SliderField,
  rawValue: string,
): ControlSettings {
  const value = rawValue.trim() === "" ? Number.NaN : Number(rawValue);
  if (!Number.isFinite(value)) {
    return sanitizeControlSettings(settings);
  }
  const { min, max } = CONTROL_SETTINGS_LIMITS[field];
  const clamped = Math.min(max, Math.max(min, value));
  return sanitizeControlSettings({
    ...settings,
    [field]: roundToStep(clamped, field),
  });
}

export function sliderValue(
  settings: ControlSettings,
  field: SliderField,
): string {
  return String(settings[field]);
}

export function applyToggle(
  settings: ControlSettings,
  field: ToggleField,
  checked: boolean,
): ControlSettings {
  return sanitizeControlSettings({ ...settings, [field]: checked });
}

export function resetControlSettings(): ControlSettings {
  return { ...DEFAULT_CONTROL_SETTINGS };
}

export function formatSettingValue(field: SliderField, value: number): string {
  return field === "sensitivity"
    ? `${value.toFixed(2)}x`
    : `${((value * 180) / Math.PI).toFixed(1)}°`;
}
