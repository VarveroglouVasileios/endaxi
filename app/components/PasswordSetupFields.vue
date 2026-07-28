<script setup lang="ts">
import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
} from '../../shared/auth-validation'

const props = withDefaults(
  defineProps<{
    idPrefix: string
    submitted?: boolean
  }>(),
  {
    submitted: false,
  },
)

const password = defineModel<string>('password', { required: true })
const confirmation = defineModel<string>('confirmation', { required: true })

const showPassword = ref(false)
const showConfirmation = ref(false)
const confirmationTouched = ref(false)

const passwordHasError = computed(
  () => props.submitted && !isStrongPassword(password.value),
)
const confirmationHasError = computed(
  () =>
    (confirmationTouched.value || props.submitted)
    && password.value !== confirmation.value,
)

const passwordId = `${props.idPrefix}-password`
const rulesId = `${props.idPrefix}-password-rules`
const confirmationId = `${props.idPrefix}-password-confirmation`
const confirmationErrorId = `${props.idPrefix}-password-confirmation-error`
</script>

<template>
  <div>
    <label :for="passwordId" class="label">Κωδικός</label>
    <div class="relative">
      <input
        :id="passwordId"
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        class="input pr-12"
        :class="{ 'input-error': passwordHasError }"
        required
        autocomplete="new-password"
        :minlength="PASSWORD_MIN_LENGTH"
        :maxlength="PASSWORD_MAX_LENGTH"
        :aria-describedby="rulesId"
        :aria-invalid="passwordHasError"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg"
        :aria-label="showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'"
        :aria-pressed="showPassword"
        @click="showPassword = !showPassword"
      >
        <svg
          v-if="!showPassword"
          aria-hidden="true"
          class="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z"
          />
          <circle cx="12" cy="12" r="2.75" stroke-width="1.8" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          class="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-width="1.8"
            d="m4 4 16 16M10.6 6.1c.46-.07.93-.1 1.4-.1 6.25 0 9.75 6 9.75 6a17 17 0 0 1-2.1 2.8M7.1 7.3A16.7 16.7 0 0 0 2.25 12s3.5 6 9.75 6c1.26 0 2.4-.24 3.4-.62M9.9 9.9a3 3 0 0 0 4.2 4.2"
          />
        </svg>
      </button>
    </div>
    <ul :id="rulesId" class="mt-2 grid gap-1 text-xs sm:grid-cols-2">
      <li
        v-for="rule in PASSWORD_RULES"
        :key="rule.id"
        class="flex items-center gap-1.5"
        :style="{ color: rule.test(password) ? 'var(--color-ok)' : 'var(--color-ink-muted)' }"
      >
        <span aria-hidden="true">{{ rule.test(password) ? '✓' : '○' }}</span>
        {{ rule.label }}
      </li>
    </ul>
  </div>

  <div>
    <label :for="confirmationId" class="label">Επιβεβαίωση κωδικού</label>
    <div class="relative">
      <input
        :id="confirmationId"
        v-model="confirmation"
        :type="showConfirmation ? 'text' : 'password'"
        class="input pr-12"
        :class="{ 'input-error': confirmationHasError }"
        required
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX_LENGTH"
        :aria-describedby="confirmationErrorId"
        :aria-invalid="confirmationHasError"
        @blur="confirmationTouched = true"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg"
        :aria-label="
          showConfirmation
            ? 'Απόκρυψη επιβεβαίωσης κωδικού'
            : 'Εμφάνιση επιβεβαίωσης κωδικού'
        "
        :aria-pressed="showConfirmation"
        @click="showConfirmation = !showConfirmation"
      >
        <svg
          v-if="!showConfirmation"
          aria-hidden="true"
          class="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z"
          />
          <circle cx="12" cy="12" r="2.75" stroke-width="1.8" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          class="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-width="1.8"
            d="m4 4 16 16M10.6 6.1c.46-.07.93-.1 1.4-.1 6.25 0 9.75 6 9.75 6a17 17 0 0 1-2.1 2.8M7.1 7.3A16.7 16.7 0 0 0 2.25 12s3.5 6 9.75 6c1.26 0 2.4-.24 3.4-.62M9.9 9.9a3 3 0 0 0 4.2 4.2"
          />
        </svg>
      </button>
    </div>
    <p v-if="confirmationHasError" :id="confirmationErrorId" class="error-text">
      Οι δύο κωδικοί δεν ταιριάζουν.
    </p>
  </div>
</template>
