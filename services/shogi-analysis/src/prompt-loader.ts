import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PROMPTS_DIR = join(__dirname, '..', 'prompts')

/**
 * Load a prompt template from markdown file
 * @param filename - The markdown file name (without .md extension)
 * @returns The prompt content
 */
export function loadPrompt(filename: string): string {
  const filepath = join(PROMPTS_DIR, `${filename}.md`)
  try {
    return readFileSync(filepath, 'utf-8').trim()
  }
  catch (error) {
    throw new Error(`Failed to load prompt: ${filename}.md - ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Replace placeholders in prompt template
 * @param template - The template string with {{PLACEHOLDER}} syntax
 * @param values - Object with placeholder values
 * @returns The filled template
 */
export function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let result = template

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`
    result = result.replace(new RegExp(placeholder, 'g'), value)
  }

  // Remove empty placeholders (optional values)
  result = result.replace(/\{\{[A-Z_]+\}\}\n?/g, '')

  return result.trim()
}

/**
 * Cache for loaded prompts
 */
const promptCache = new Map<string, string>()

/**
 * Load and cache a prompt template
 * @param filename - The markdown file name
 * @returns The cached prompt content
 */
export function getCachedPrompt(filename: string): string {
  if (!promptCache.has(filename)) {
    promptCache.set(filename, loadPrompt(filename))
  }
  return promptCache.get(filename)!
}
