<script setup>
/**
 * Add / edit task modal (spec §11).
 *
 * Create mode requires only a title; edit mode pre-fills the current values and
 * carries the task's `version` so the backend can reject a concurrent edit
 * (409) rather than silently overwriting it.
 */
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { rules } from '@/utils/validators.js';
import { STATUS_OPTIONS, today } from '@/utils/task.js';

const props = defineProps({
  task: { type: Object, default: null },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['submit']);
const model = defineModel({ type: Boolean, default: false });

const formRef = ref(null);
const titleRef = ref(null);
const isValid = ref(false);
// Field errors reported by the backend, cleared as soon as the user edits.
const serverErrors = reactive({});

const form = reactive({ title: '', description: '', status: 'pending', deadline: null });

const isEdit = computed(() => Boolean(props.task?.id));
const heading = computed(() => (isEdit.value ? 'Edit task' : 'New task'));
const submitLabel = computed(() => (isEdit.value ? 'Save changes' : 'Create task'));

const DEADLINE_SHORTCUTS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
];

function reset() {
  Object.assign(form, {
    title: props.task?.title ?? '',
    description: props.task?.description ?? '',
    status: props.task?.status ?? 'pending',
    deadline: props.task?.deadline ? String(props.task.deadline).slice(0, 10) : null,
  });
  for (const key of Object.keys(serverErrors)) delete serverErrors[key];
}

// Refill whenever the dialog opens, so a cancelled edit never leaks into the next one.
watch(model, async (open) => {
  if (!open) return;
  reset();
  await nextTick();
  formRef.value?.resetValidation();
  titleRef.value?.focus();
});

function setDeadline(days) {
  const date = new Date(`${today()}T00:00:00`);
  date.setDate(date.getDate() + days);
  form.deadline = date.toISOString().slice(0, 10);
}

function clearServerError(field) {
  if (serverErrors[field]) delete serverErrors[field];
}

/** Called by the parent when the API rejects the submission with field errors. */
function applyServerErrors(fieldErrors = {}) {
  for (const [field, message] of Object.entries(fieldErrors)) serverErrors[field] = message;
}

async function submit() {
  const { valid } = await formRef.value.validate();
  if (!valid || props.saving) return;

  emit('submit', {
    title: form.title.trim(),
    description: form.description?.trim() ? form.description.trim() : null,
    status: form.status,
    deadline: form.deadline || null,
    ...(isEdit.value ? { version: props.task.version } : {}),
  });
}

defineExpose({ applyServerErrors });
</script>

<template>
  <v-dialog v-model="model" max-width="620" scrollable :persistent="saving">
    <v-card>
      <v-card-item class="pb-2">
        <template #prepend>
          <v-avatar color="primary" variant="tonal" size="42">
            <v-icon :icon="isEdit ? 'mdi-pencil' : 'mdi-plus'" />
          </v-avatar>
        </template>
        <v-card-title class="text-h6">{{ heading }}</v-card-title>
        <v-card-subtitle>{{ isEdit ? 'Update the details below.' : 'Only a title is required.' }}</v-card-subtitle>
      </v-card-item>

      <v-divider />

      <v-card-text>
        <!-- @submit.prevent + a submit button means Enter submits the form. -->
        <v-form ref="formRef" v-model="isValid" validate-on="submit" @submit.prevent="submit">
          <v-text-field
            ref="titleRef"
            v-model="form.title"
            label="Title *"
            placeholder="What needs doing?"
            counter="200"
            maxlength="200"
            autocomplete="off"
            :rules="rules.title"
            :error-messages="serverErrors.title"
            class="mb-4"
            @update:model-value="clearServerError('title')"
          />

          <v-textarea
            v-model="form.description"
            label="Description"
            placeholder="Optional details, links or acceptance criteria"
            rows="3"
            auto-grow
            counter="5000"
            maxlength="5000"
            :rules="rules.description"
            :error-messages="serverErrors.description"
            class="mb-4"
            @update:model-value="clearServerError('description')"
          />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.status"
                label="Status"
                :items="STATUS_OPTIONS"
                item-title="label"
                item-value="value"
                :error-messages="serverErrors.status"
                @update:model-value="clearServerError('status')"
              >
                <template #item="{ props: itemProps, item }">
                  <v-list-item v-bind="itemProps" :prepend-icon="item.raw.icon" />
                </template>
              </v-select>
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.deadline"
                label="Deadline"
                type="date"
                hint="Optional — YYYY-MM-DD"
                persistent-hint
                clearable
                :rules="rules.deadline"
                :error-messages="serverErrors.deadline"
                @update:model-value="clearServerError('deadline')"
              />
            </v-col>
          </v-row>

          <div class="d-flex flex-wrap ga-2 mt-3">
            <span class="text-caption text-medium-emphasis align-self-center mr-1">Quick set:</span>
            <v-chip
              v-for="shortcut in DEADLINE_SHORTCUTS"
              :key="shortcut.label"
              size="small"
              variant="outlined"
              link
              @click="setDeadline(shortcut.days)"
            >
              {{ shortcut.label }}
            </v-chip>
            <v-chip
              v-if="form.deadline"
              size="small"
              variant="text"
              link
              prepend-icon="mdi-close"
              @click="form.deadline = null"
            >
              Clear
            </v-chip>
          </div>
        </v-form>
      </v-card-text>

      <v-divider />

      <v-card-actions class="px-4 py-3">
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="model = false">Cancel</v-btn>
        <!-- Disabled while saving so a double click cannot create two tasks. -->
        <v-btn color="primary" variant="flat" :loading="saving" :disabled="saving" @click="submit">
          {{ submitLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
