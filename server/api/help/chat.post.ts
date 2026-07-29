import { createGroq } from '@ai-sdk/groq'

import {
  findSensitiveInput,
  generateHelpReply,
  helpChatBodySchema,
} from '../../utils/help-chat'

function getProviderStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && typeof error.statusCode === 'number'
  ) {
    return error.statusCode
  }
  return undefined
}

export default defineEventHandler(async (event) => {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  const config = useRuntimeConfig(event)

  setResponseHeaders(event, {
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
  })

  // Ένα browser fetch() POST στέλνει ΠΑΝΤΑ Origin — η απουσία του δεν
  // πρέπει να προσπερνά τον έλεγχο (θα άφηνε ανοιχτή μια «χωρίς Origin»
  // παράκαμψη για μη-browser clients που τρώνε το Groq quota μας).
  const origin = getHeader(event, 'origin')
  const appOrigin = new URL(config.public.appUrl).origin
  // Σε development επιτρέπεται και το localhost ώστε να δουλεύει τοπικά.
  const isDev = process.env.NODE_ENV !== 'production'
  const isLocalhost = isDev && origin != null && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (origin !== appOrigin && !isLocalhost) {
    throw createError({
      statusCode: 403,
      statusMessage: 'ORIGIN_NOT_ALLOWED',
      data: { message: 'Το αίτημα δεν επιτρέπεται από αυτή την προέλευση.' },
    })
  }

  if (!config.groqApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'AI_NOT_CONFIGURED',
      data: { message: 'Η AI βοήθεια δεν είναι διαθέσιμη αυτή τη στιγμή.' },
    })
  }

  let body
  try {
    body = await readValidatedBody(event, value => helpChatBodySchema.parse(value))
  } catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'statusCode' in error
      && error.statusCode === 413
    ) {
      throw error
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'INVALID_CHAT',
      data: { message: 'Η συνομιλία δεν έχει έγκυρη μορφή.' },
    })
  }

  const sensitiveKind = findSensitiveInput(body.messages)
  if (sensitiveKind) {
    throw createError({
      statusCode: 422,
      statusMessage: 'SENSITIVE_INPUT',
      data: {
        message: `Αφαίρεσε το ${sensitiveKind} πριν στείλεις το μήνυμα. Μην κοινοποιείς προσωπικά ή απόρρητα δεδομένα.`,
      },
    })
  }

  try {
    const groq = createGroq({ apiKey: config.groqApiKey })
    const reply = await generateHelpReply(
      groq(config.groqModel || 'openai/gpt-oss-20b'),
      body.messages,
    )

    console.info('[help-chat]', {
      requestId,
      status: 'success',
      durationMs: Date.now() - startedAt,
      messageCount: body.messages.length,
      characterCount: body.messages.reduce(
        (total, message) => total + message.content.length,
        0,
      ),
    })

    return { reply, requestId }
  } catch (error) {
    const providerStatus = getProviderStatus(error)
    console.error('[help-chat]', {
      requestId,
      status: providerStatus === 429 ? 'busy' : 'unavailable',
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    })

    throw createError({
      statusCode: 503,
      statusMessage: providerStatus === 429 ? 'AI_BUSY' : 'AI_UNAVAILABLE',
      data: {
        message:
          providerStatus === 429
            ? 'Η AI βοήθεια έχει αυξημένη κίνηση. Δοκίμασε ξανά σε λίγο.'
            : 'Η AI βοήθεια δεν είναι διαθέσιμη αυτή τη στιγμή.',
      },
    })
  }
})
