<script setup>
/**
 * Login page (spec §10.1): email, password, submit, validation feedback and a
 * link to registration.
 */
import { ref, reactive, nextTick, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { rules } from '@/utils/validators.js';

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();

const formRef = ref(null);
const emailRef = ref(null);
const showPassword = ref(false);
const formError = ref('');
const serverErrors = reactive({});

const form = reactive({ email: '', password: '' });

onMounted(() => nextTick(() => emailRef.value?.focus()));

function clearErrors(field) {
  formError.value = '';
  if (serverErrors[field]) delete serverErrors[field];
}

async function submit() {
  const { valid } = await formRef.value.validate();
  if (!valid || auth.isSubmitting) return;

  formError.value = '';
  const { ok, error } = await auth.login({ email: form.email.trim(), password: form.password });

  if (ok) {
    ui.notify(`Welcome back, ${auth.user.name.split(' ')[0]}!`);
    // Return to wherever the guard interrupted, or the task page.
    await router.push(route.query.redirect || { name: 'tasks' });
    return;
  }

  if (error.status === 422) {
    Object.assign(serverErrors, error.fieldErrors);
    formError.value = 'Please check the highlighted fields.';
  } else {
    // 401 and network failures are shown as a single banner above the form.
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
            <v-icon icon="mdi-check-all" size="30" />
          </v-avatar>
          <h1 class="text-h5 font-weight-bold">Task Manager</h1>
          <p class="text-body-2 text-medium-emphasis">Sign in to see your tasks</p>
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
                ref="emailRef"
                v-model="form.email"
                label="Email"
                type="email"
                autocomplete="email"
                prepend-inner-icon="mdi-email-outline"
                :rules="rules.email"
                :error-messages="serverErrors.email"
                class="mb-4"
                @update:model-value="clearErrors('email')"
              />

              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                :rules="rules.loginPassword"
                :error-messages="serverErrors.password"
                class="mb-6"
                @click:append-inner="showPassword = !showPassword"
                @update:model-value="clearErrors('password')"
              />

              <!-- type=submit means Enter submits from any field. -->
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="auth.isSubmitting"
                :disabled="auth.isSubmitting"
              >
                Sign in
              </v-btn>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="justify-center py-3">
            <span class="text-body-2 text-medium-emphasis">No account yet?</span>
            <v-btn variant="text" color="primary" class="text-none" :to="{ name: 'register' }">
              Create one
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
