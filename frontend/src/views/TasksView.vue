<script setup>
/**
 * The protected task page (spec §10.3): list, status filter, add, edit, delete.
 * Logout lives in the app bar, which is shared by every authenticated page.
 */
import { ref, computed, onMounted } from 'vue';
import { useTaskStore } from '@/stores/tasks.js';
import { useUiStore } from '@/stores/ui.js';
import TaskCard from '@/components/TaskCard.vue';
import TaskFilters from '@/components/TaskFilters.vue';
import TaskFormDialog from '@/components/TaskFormDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';

const tasks = useTaskStore();
const ui = useUiStore();

const formDialog = ref(false);
const formRef = ref(null);
const editingTask = ref(null);

const confirmDialog = ref(false);
const taskToDelete = ref(null);

const isDeleting = computed(() => taskToDelete.value !== null && tasks.deletingId === taskToDelete.value.id);
const deleteMessage = computed(
  () => `"${taskToDelete.value?.title ?? ''}" will be permanently removed. This cannot be undone.`,
);
const showPagination = computed(() => (tasks.pagination.total_pages || 0) > 1);

onMounted(() => tasks.fetchTasks());

function openCreate() {
  editingTask.value = null;
  formDialog.value = true;
}

function openEdit(task) {
  editingTask.value = { ...task };
  formDialog.value = true;
}

async function handleSubmit(payload) {
  const result = editingTask.value
    ? await tasks.updateTask(editingTask.value.id, payload)
    : await tasks.createTask(payload);

  if (result.ok) {
    formDialog.value = false;
    editingTask.value = null;
    return;
  }

  // Keep the dialog open on failure so nothing the user typed is lost.
  const { error } = result;
  if (error.status === 422) {
    formRef.value?.applyServerErrors(error.fieldErrors);
    ui.notifyError('Please check the highlighted fields.');
  } else {
    ui.notifyError(error.message);
    // The task is gone or was changed elsewhere: the list has been refreshed,
    // so close the stale form.
    if (error.status === 404 || error.status === 409) {
      formDialog.value = false;
      editingTask.value = null;
    }
  }
}

function askDelete(task) {
  taskToDelete.value = task;
  confirmDialog.value = true;
}

async function confirmDelete() {
  const target = taskToDelete.value;
  if (!target) return;
  const { ok } = await tasks.deleteTask(target.id);
  if (ok) {
    confirmDialog.value = false;
    taskToDelete.value = null;
  }
}
</script>

<template>
  <v-container class="py-6 py-md-8" max-width="1280">
    <!-- Header -->
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-5">
      <div>
        <h1 class="text-h5 text-md-h4 font-weight-bold">My tasks</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          {{ tasks.pagination.total }}
          {{ tasks.pagination.total === 1 ? 'task' : 'tasks' }}
          <span v-if="tasks.hasActiveFilters">matching your filters</span>
        </p>
      </div>

      <v-btn color="primary" size="large" prepend-icon="mdi-plus" @click="openCreate">
        Add task
      </v-btn>
    </div>

    <v-card border flat class="pa-4 pa-md-5 mb-5">
      <TaskFilters
        :status="tasks.filters.status"
        :search="tasks.filters.search"
        :sort-by="tasks.filters.sortBy"
        :sort-dir="tasks.filters.sortDir"
        :counts="tasks.statusCounts"
        :loading="tasks.isLoading"
        @update:status="tasks.setStatus($event)"
        @update:search="tasks.setSearch($event)"
        @update:sort="tasks.setSort($event)"
      />
    </v-card>

    <!-- Retryable load failure (spec §13) -->
    <v-alert
      v-if="tasks.loadError"
      type="error"
      variant="tonal"
      class="mb-5"
      :text="tasks.loadError"
    >
      <template #append>
        <v-btn variant="text" size="small" @click="tasks.fetchTasks()">Retry</v-btn>
      </template>
    </v-alert>

    <!-- Loading skeletons keep the layout from jumping -->
    <v-row v-if="tasks.isLoading && tasks.items.length === 0" dense>
      <v-col v-for="index in 6" :key="index" cols="12" sm="6" lg="4">
        <v-skeleton-loader type="article, actions" class="rounded-lg" />
      </v-col>
    </v-row>

    <template v-else-if="tasks.isEmpty && !tasks.loadError">
      <v-card border flat>
        <EmptyState
          v-if="tasks.hasActiveFilters"
          icon="mdi-filter-remove-outline"
          title="No tasks match these filters"
          message="Try a different status, or clear the search term."
        >
          <v-btn variant="tonal" color="primary" @click="tasks.resetFilters()">Clear filters</v-btn>
        </EmptyState>

        <EmptyState
          v-else
          title="No tasks yet"
          message="Create your first task and it will show up here. Only you can see your tasks."
        >
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Add your first task</v-btn>
        </EmptyState>
      </v-card>
    </template>

    <template v-else>
      <v-row dense :class="{ 'task-grid--loading': tasks.isLoading }">
        <v-col v-for="task in tasks.items" :key="task.id" cols="12" sm="6" lg="4">
          <TaskCard
            :task="task"
            :updating-status="tasks.updatingStatusId === task.id"
            :deleting="tasks.deletingId === task.id"
            @edit="openEdit(task)"
            @delete="askDelete(task)"
            @status-change="tasks.changeStatus(task, $event)"
          />
        </v-col>
      </v-row>

      <div v-if="showPagination" class="d-flex flex-column align-center mt-6 ga-2">
        <v-pagination
          :model-value="tasks.pagination.page"
          :length="tasks.pagination.total_pages"
          :total-visible="4"
          density="comfortable"
          rounded="circle"
          :disabled="tasks.isLoading"
          @update:model-value="tasks.setPage($event)"
        />
        <span class="text-caption text-medium-emphasis">
          Page {{ tasks.pagination.page }} of {{ tasks.pagination.total_pages }}
          · {{ tasks.pagination.total }} tasks
        </span>
      </div>
    </template>

    <!-- Add / edit modal -->
    <TaskFormDialog
      ref="formRef"
      v-model="formDialog"
      :task="editingTask"
      :saving="tasks.isSaving"
      @submit="handleSubmit"
    />

    <!-- Deletion needs an explicit confirmation (spec §5.4) -->
    <ConfirmDialog
      v-model="confirmDialog"
      title="Delete this task?"
      :message="deleteMessage"
      confirm-text="Delete"
      icon="mdi-delete-outline"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="taskToDelete = null"
    />
  </v-container>
</template>

<style scoped>
/* Dim the grid while a filter or page change is in flight. */
.task-grid--loading {
  opacity: 0.55;
  transition: opacity 120ms ease;
  pointer-events: none;
}
</style>
