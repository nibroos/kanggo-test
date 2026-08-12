<script setup>
import { computed, onMounted, ref } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from '@/stores/auth.js';
import { useTaskStore } from '@/stores/tasks.js';
import AppSnackbar from '@/components/AppSnackbar.vue';

const auth = useAuthStore();
const tasks = useTaskStore();
const theme = useTheme();

const isDark = ref(false);
const isLoggingOut = ref(false);
const userName = computed(() => auth.user?.name || '');

const THEME_KEY = 'tm.theme';

onMounted(() => {
  // Remember the choice, and fall back to the operating system preference.
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  isDark.value = stored ? stored === 'dark' : Boolean(prefersDark);
  theme.change(isDark.value ? 'dark' : 'light');
});

function toggleTheme() {
  isDark.value = !isDark.value;
  theme.change(isDark.value ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light');
}

async function handleLogout() {
  isLoggingOut.value = true;
  try {
    await auth.logout();
    // Wipe the list so the next account never sees the previous one's tasks.
    tasks.reset();
  } finally {
    isLoggingOut.value = false;
  }
}
</script>

<template>
  <v-app>
    <v-app-bar v-if="auth.isAuthenticated" flat border density="comfortable">
      <v-app-bar-title class="font-weight-bold">
        <v-icon icon="mdi-check-all" class="mr-2" color="primary" />
        Task Manager
      </v-app-bar-title>

      <template #append>
        <v-btn
          :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="text"
          :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggleTheme"
        />

        <!-- Compact: avatar menu. Wide: name plus an explicit logout button. -->
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="text" class="text-none px-2" aria-label="Account menu">
              <v-avatar color="primary" size="32" class="mr-2">
                <span class="text-caption font-weight-bold">{{ auth.initials }}</span>
              </v-avatar>
              <span class="d-none d-sm-inline">{{ userName }}</span>
              <v-icon icon="mdi-chevron-down" size="small" class="ml-1" />
            </v-btn>
          </template>

          <v-list density="compact" min-width="200">
            <v-list-item :title="userName" :subtitle="auth.user?.email" />
            <v-divider />
            <v-list-item
              prepend-icon="mdi-logout"
              title="Sign out"
              :disabled="isLoggingOut"
              @click="handleLogout"
            />
          </v-list>
        </v-menu>

        <v-btn
          class="d-none d-md-inline-flex ml-2"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-logout"
          :loading="isLoggingOut"
          :disabled="isLoggingOut"
          @click="handleLogout"
        >
          Logout
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <router-view v-slot="{ Component }">
        <v-fade-transition mode="out-in">
          <component :is="Component" />
        </v-fade-transition>
      </router-view>
    </v-main>

    <AppSnackbar />
  </v-app>
</template>
