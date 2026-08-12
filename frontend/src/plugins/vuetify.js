import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

/**
 * Vuetify 3 with a light and a dark theme. Defaults are set once here so every
 * form control in the app looks and behaves the same (policy §22: one design
 * system, consistent components).
 */
export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#f5f7fa',
          surface: '#ffffff',
          primary: '#3b5bdb',
          secondary: '#5c7cfa',
          success: '#2f9e44',
          warning: '#f08c00',
          error: '#e03131',
          info: '#1971c2',
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#12151c',
          surface: '#1b1f2a',
          primary: '#748ffc',
          secondary: '#91a7ff',
          success: '#51cf66',
          warning: '#ffc078',
          error: '#ff8787',
          info: '#4dabf7',
        },
      },
    },
  },
  defaults: {
    VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VTextarea: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VSelect: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VBtn: { variant: 'flat' },
    VCard: { rounded: 'lg' },
  },
});
