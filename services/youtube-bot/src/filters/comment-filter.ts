import { useLogg } from '@guiiai/logg'

const log = useLogg('CommentFilter').useGlobalConfig()

/**
 * Configuration for CommentFilter
 */
export interface FilterConfig {
  enabled: boolean // Enable/disable filter
  minLength: number // Minimum comment length
  logFiltered: boolean // Log filtered comments
  customNoisePatterns?: string[] // Custom noise regex patterns
  customNoiseWords?: string[] // Custom noise words
}

/**
 * Result of filter decision
 */
export interface FilterResult {
  shouldRespond: boolean // Whether to respond to the comment
  reason: string // Reason for the decision
  matchedPattern?: string // Pattern that matched (if filtered)
}

/**
 * Default noise patterns (regex)
 * These patterns match common noise/reaction comments
 */
const DEFAULT_NOISE_PATTERNS = [
  /^w+$/i, // 「w」「www」「WWWW」
  /^[wｗ]{3,}$/i, // Full-width/half-width 「w」3+ chars
  /^草+$/, // 「草」「草草草」
  /^笑+$/, // 「笑」「笑笑笑」
  /^[笑w草ｗ]{3,}$/i, // Mixed laugh patterns
  /^8{5,}$/, // 「88888」clapping
  /^[!！?？。、]+$/, // Punctuation only
  /^l(ol)+$/i, // 「lol」「lolol」「lololol」
  /^あ+$/, // 「あ」「ああああ」
  /^[。、！？\s]+$/, // Whitespace/punctuation only
  /^\p{Emoji}+$/u, // Emoji only
]

/**
 * Default noise words
 * These are short reactions that don't warrant a response
 */
const DEFAULT_NOISE_WORDS = [
  'ウケる',
  '面白い',
  'うん',
  'へー',
  'ほー',
  'はい',
  'いいね',
  'おk',
  'ok',
  'おけ',
]

/**
 * Whitelist patterns (always pass)
 * These patterns indicate meaningful comments
 */
const DEFAULT_WHITELIST_PATTERNS = [
  /[^!！?？。、\s][^!！?？。、]*[?？]/, // Contains question mark with other content
  /.{15,}/, // 15+ characters (likely meaningful)
]

/**
 * Comment Filter for YouTube Live Chat
 *
 * Filters out noise/reaction comments using rule-based patterns.
 * Future: Can be extended with embedding/LLM classification.
 */
export class CommentFilter {
  private config: FilterConfig
  private noisePatterns: RegExp[]
  private noiseWords: Set<string>
  private whitelistPatterns: RegExp[]

  constructor(config: FilterConfig) {
    this.config = config

    // Initialize noise patterns
    this.noisePatterns = [...DEFAULT_NOISE_PATTERNS]

    // Add custom patterns if provided
    if (config.customNoisePatterns) {
      config.customNoisePatterns.forEach((pattern) => {
        try {
          this.noisePatterns.push(new RegExp(pattern))
        }
        catch (error) {
          log.withError(error).warn(`Invalid custom noise pattern: ${pattern}`)
        }
      })
    }

    // Initialize noise words
    this.noiseWords = new Set(DEFAULT_NOISE_WORDS)

    // Add custom noise words if provided
    if (config.customNoiseWords) {
      config.customNoiseWords.forEach(word => this.noiseWords.add(word))
    }

    // Initialize whitelist patterns
    this.whitelistPatterns = [...DEFAULT_WHITELIST_PATTERNS]

    log
      .withField('enabled', config.enabled)
      .withField('minLength', config.minLength)
      .withField('logFiltered', config.logFiltered)
      .withField('noisePatterns', this.noisePatterns.length)
      .withField('noiseWords', this.noiseWords.size)
      .log('CommentFilter initialized')
  }

  /**
   * Determine whether to respond to a comment
   *
   * Filter priority:
   * 1. Whitelist check (questions, long text) → Pass
   * 2. Length check (too short) → Filter
   * 3. Noise pattern match → Filter
   * 4. Noise word match → Filter
   * 5. Default → Pass
   */
  shouldRespond(text: string): FilterResult {
    // If filter is disabled, always respond
    if (!this.config.enabled) {
      return {
        shouldRespond: true,
        reason: 'Filter disabled',
      }
    }

    const trimmed = text.trim()

    // Empty comment
    if (trimmed.length === 0) {
      return this.createFilterResult(false, 'Empty comment')
    }

    // Normalize text (remove spaces for pattern matching)
    const normalized = this.normalizeText(trimmed)

    // Priority 1: Whitelist check
    for (const pattern of this.whitelistPatterns) {
      if (pattern.test(trimmed)) {
        return this.createFilterResult(true, 'Whitelisted pattern', pattern.source)
      }
    }

    // Priority 2: Length check
    if (trimmed.length < this.config.minLength) {
      return this.createFilterResult(
        false,
        `Too short (${trimmed.length} < ${this.config.minLength})`,
      )
    }

    // Priority 3: Noise pattern check
    for (const pattern of this.noisePatterns) {
      if (pattern.test(normalized)) {
        return this.createFilterResult(false, 'Matched noise pattern', pattern.source)
      }
    }

    // Priority 4: Noise word check
    if (this.noiseWords.has(normalized)) {
      return this.createFilterResult(false, 'Matched noise word', normalized)
    }

    // Default: Pass through
    return this.createFilterResult(true, 'No filter matched')
  }

  /**
   * Normalize text for pattern matching
   * - Removes whitespace
   * - Converts full-width alphanumeric to half-width
   */
  private normalizeText(text: string): string {
    let normalized = text.replace(/\s+/g, '') // Remove all whitespace

    // Convert full-width alphanumeric to half-width
    normalized = normalized.replace(/[\uFF10-\uFF19\uFF21-\uFF3A]/gi, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
    })

    return normalized
  }

  /**
   * Create filter result and optionally log it
   */
  private createFilterResult(
    shouldRespond: boolean,
    reason: string,
    matchedPattern?: string,
  ): FilterResult {
    const result: FilterResult = {
      shouldRespond,
      reason,
      matchedPattern,
    }

    // Log filtered comments if enabled
    if (this.config.logFiltered && !shouldRespond) {
      log
        .withField('shouldRespond', shouldRespond)
        .withField('reason', reason)
        .withField('matchedPattern', matchedPattern)
        .log('Comment filtered')
    }

    return result
  }
}
