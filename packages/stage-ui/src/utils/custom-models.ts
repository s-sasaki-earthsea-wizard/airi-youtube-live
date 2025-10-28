import type { DisplayModel } from '../stores/display-models'

import { DisplayModelFormat } from '../stores/display-models'

/**
 * Custom VRM model configuration from environment variables
 */
export interface CustomVRMConfig {
  filename: string
  name?: string
  previewImage?: string
}

/**
 * Get custom VRM model configuration from environment variables
 * @param env Optional environment variables object (defaults to import.meta.env)
 * @returns Custom VRM configuration if VITE_CUSTOM_VRM_FILENAME is set, otherwise null
 */
export function getCustomVRMConfig(env?: Record<string, any>): CustomVRMConfig | null {
  // Use provided env or try to access import.meta.env
  const envVars = env || ((typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<string, any>)

  const filename = envVars.VITE_CUSTOM_VRM_FILENAME as string | undefined

  if (!filename) {
    return null
  }

  return {
    filename,
    name: envVars.VITE_CUSTOM_VRM_NAME as string | undefined,
    previewImage: envVars.VITE_CUSTOM_VRM_PREVIEW as string | undefined,
  }
}

/**
 * Build a DisplayModel from custom VRM configuration
 * @param config Custom VRM configuration
 * @returns DisplayModel for the custom VRM
 */
export function buildCustomVRMModel(config: CustomVRMConfig): DisplayModel {
  return {
    id: 'custom-vrm-env',
    format: DisplayModelFormat.VRM,
    type: 'url',
    url: `/custom-models/vrm/${config.filename}`,
    name: config.name || 'Custom VRM',
    previewImage: config.previewImage
      ? `/custom-models/vrm/${config.previewImage}`
      : undefined,
    importedAt: Date.now(),
  }
}

/**
 * Get custom VRM model as DisplayModel if configured
 * @param env Optional environment variables object (defaults to import.meta.env)
 * @returns DisplayModel if custom VRM is configured, otherwise null
 */
export function getCustomVRMModel(env?: Record<string, any>): DisplayModel | null {
  const config = getCustomVRMConfig(env)
  if (!config) {
    return null
  }
  return buildCustomVRMModel(config)
}
