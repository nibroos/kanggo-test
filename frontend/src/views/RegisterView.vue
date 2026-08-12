<script setup>
/**
 * Registration page (spec §10.2): name, email, password, submit, validation
 * feedback and a link back to sign-in.
 */
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { rules } from '@/utils/validators.js';

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();

const formRef = ref(null);
const nameRef = ref(null);
const showPassword = ref(false);
const formError = ref('');
const serverErrors = reactive({});

const form = reactive({ name: '', email: '', password: '' });

// Simple strength meter: length plus character variety. Guidance only — the
// backend's rule is the 8 character minimum.
const passwordStrength = computed(() => {
  const value = form.password;
  if (!value) return { value: 0, color: 'grey', label: '' };

  let score = 0;
  if (value.length >= 8) score += 34;
  if (value.length >= 12) score += 16;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 25;
  if (/\d/.test(value)) score += 15;
  if (/[^A-Za-z0-9]/.test(value)) score += 10;

  const capped = Math.min(score, 100);
  if (capped < 40) return { value: capped, color: 'error', label: 'Weak' };
  if (capped < 75) return { value: capped, color: 'warning', label: 'Fair' };
  return { value: capped, color: 'success', label: 'Strong' };
});

onMounted(() => nextTick(() => nameRef.value?.focus()));

function clearErrors(field) {
  formError.value = '';
  if (serverErrors[field]) delete serverErrors[field];
}

async function submit() {
  const { valid } = await formRef.value.validate();
  if (!valid || auth.isSubmitting) return;

  formError.value = '';
  const { ok, error } = await auth.register({
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
  });

  if (ok) {
    ui.notify(`Welcome, ${auth.user.name.split(' ')[0]}! Your account is ready.`);
    await router.push({ name: 'tasks' });
    return;
  }

  if (error.status === 422) {
    Object.assign(serverErrors, error.fieldErrors);
    formError.value = 'Please check the highlighted fields.';
  } else if (error.status === 409) {
    serverErrors.email = error.message;
    formError.value = error.message;
  } else {
    formError.value = error.message;
  }
}
</script>

<template>
  <v-container class="fill-height py-8" fluid>
    <v-row justify="center" align="center" class="w-100">
      <v-col cols="12" sm="9" md="6" lg="4">
        <div class="text-center mb-6">
          <v-avatar color="primary" size="56" class="mb-3">
            <v-icon icon="mdi-account-plus-outline" size="30" />
          </v-avatar>
          <h1 class="text-h5 font-weight-bold">Create your account</h1>
          <p class="text-body-2 text-medium-emphasis">Your tasks stay private to you</p>
        </div>

        <v-card border flat>
          <v-card-text class="pa-6">
            <v-alert
              v-if="formError"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-4"
              :text="formError"
            />

            <v-form ref="formRef" validate-on="submit" @submit.prevent="submit">
              <v-text-field
                ref="nameRef"
                v-model="form.name"
                label="Name"
                autocomplete="name"
                prepend-inner-icon="mdi-account-outline"
                maxlength="100"
                :rules="rules.name"
                :error-messages="serverErrors.name"
                class="mb-4"
                @update:model-value="clearErrors('name')"
              />

              <v-text-field
                v-model="form.email"
                label="Email"
                type="email"
                autocomplete="email"
                prepend-inner-icon="mdi-email-outline"
                maxlength="191"
                :rules="rules.email"
                :error-messages="serverErrors.email"
                class="mb-4"
                @update:model-value="clearErrors('email')"
              />

              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                hint="At least 8 characters"
                persistent-hint
                :rules="rules.password"
                :error-messages="serverErrors.password"
                @click:append-inner="showPassword = !showPassword"
                @update:model-value="clearErrors('password')"
              />

              <div v-if="form.password" class="mt-3 mb-5">
                <v-progress-linear
                  :model-value="passwordStrength.value"
                  :color="passwordStrength.color"
                  height="6"
                  rounded
                />
                <span class="text-caption text-medium-emphasis">
                  Password strength: {{ passwordStrength.label }}
                </span>
              </div>
              <div v-else class="mb-6" />

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="auth.isSubmitting"
                :disabled="auth.isSubmitting"
              >
                Create account
              </v-btn>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="justify-center py-3">
            <span class="text-body-2 text-medium-emphasis">Already registered?</span>
            <v-btn variant="text" color="primary" class="text-none" :to="{ name: 'login' }">Sign in</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
