import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'

import {
  findSensitiveInput,
  generateHelpReply,
  HELP_CHAT_INSTRUCTIONS,
  HELP_CHAT_MAX_MESSAGE_LENGTH,
  helpChatBodySchema,
  type HelpChatMessage,
} from '../server/utils/help-chat'

function message(content: string): HelpChatMessage {
  return { role: 'user', content }
}

describe('help chat validation', () => {
  it('accepts a valid alternating conversation ending with the user', () => {
    expect(
      helpChatBodySchema.safeParse({
        messages: [
          message('Τι κάνει το Endaxi;'),
          { role: 'assistant', content: 'Οργανώνει διαμονές και παραστατικά.' },
          message('Στέλνει στοιχεία στην ΑΑΔΕ;'),
        ],
      }).success,
    ).toBe(true)
  })

  it.each([
    { messages: [{ role: 'assistant', content: 'Γεια' }] },
    { messages: [message('Πρώτο'), message('Δεύτερο')] },
    {
      messages: [
        message('Ερώτηση'),
        { role: 'assistant', content: 'Απάντηση' },
      ],
    },
    { messages: [{ role: 'user', content: 'ΟΚ', extra: true }] },
    { messages: [message('x'.repeat(HELP_CHAT_MAX_MESSAGE_LENGTH + 1))] },
  ])('rejects an invalid conversation', (body) => {
    expect(helpChatBodySchema.safeParse(body).success).toBe(false)
  })
})

describe('help chat privacy', () => {
  it.each([
    ['email', 'Το email μου είναι user@example.com'],
    ['ΑΦΜ', 'Το ΑΦΜ μου είναι 123456789'],
    ['τηλέφωνο', 'Πάρε με στο 6912345678'],
    ['σύνδεσμος', 'Δες το https://example.com/private'],
    ['iCal', 'Το αρχείο είναι calendar.ics'],
    ['μυστικό κλειδί', 'Το key είναι gsk_1234567890abcdef'],
  ])('detects %s', (expected, content) => {
    expect(findSensitiveInput([message(content)])).toBe(expected)
  })

  it('allows a normal product question', () => {
    expect(findSensitiveInput([message('Πώς συνδέω το ημερολόγιό μου;')])).toBeNull()
  })
})

describe('help chat policy and generation', () => {
  it('contains the required safety boundaries', () => {
    expect(HELP_CHAT_INSTRUCTIONS).toContain('Δεν παρέχεις φορολογική')
    expect(HELP_CHAT_INSTRUCTIONS).toContain('Δεν έχεις πρόσβαση')
    expect(HELP_CHAT_INSTRUCTIONS).toContain('Δεν ισχυρίζεσαι')
    expect(HELP_CHAT_INSTRUCTIONS).not.toContain('GROQ_API_KEY')
    expect(HELP_CHAT_INSTRUCTIONS).not.toContain('5 παραστατικά')
  })

  it('generates a plain text reply through the supplied model', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'Το Endaxi οργανώνει διαμονές.' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: {
            total: 20,
            noCache: 20,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 8,
            text: 8,
            reasoning: undefined,
          },
        },
        warnings: [],
      }),
    })

    await expect(
      generateHelpReply(model, [message('Τι κάνει το Endaxi;')]),
    ).resolves.toBe('Το Endaxi οργανώνει διαμονές.')
  })
})
