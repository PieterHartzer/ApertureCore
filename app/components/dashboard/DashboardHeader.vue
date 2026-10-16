<script>
import { computed } from 'vue'

export default {
  name: 'DashboardHeader',
  props: {
    headline: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    selectedDashboardId: {
      type: [String, Number],
      default: null
    },
    dashboardListStatus: {
      type: String,
      default: 'idle'
    },
    dashboards: {
      type: Array,
      default: () => []
    },
    dashboardSelectOptions: {
      type: Array,
      default: () => []
    },
    hasSelectedDashboard: {
      type: Boolean,
      default: false
    },
    dashboardEditActionLabel: {
      type: String,
      default: ''
    },
    isDashboardEditing: {
      type: Boolean,
      default: false
    },
    onDashboardSelectionChange: {
      type: Function,
      default: () => {}
    },
    openCreateDashboardDialog: {
      type: Function,
      default: () => {}
    },
    openDashboardSettings: {
      type: Function,
      default: () => {}
    },
    onToggleDashboardEditing: {
      type: Function,
      default: () => {}
    }
  },
  emits: ['dashboard-selection-change', 'create-dashboard', 'dashboard-settings', 'toggle-editing'],
  setup(props, { emit }) {
    const dashboardSelection = computed({
      get: () => props.selectedDashboardId,
      set: (value) => emit('dashboard-selection-change', value)
    })

    return { dashboardSelection }
  }
}
</script>

<template>
  <header class="dashboard-header">
    <div class="dashboard-header-content">
      <div class="dashboard-header-main">
        <h1 class="dashboard-headline">
          {{ headline || $t('navigation.dashboard') }}
        </h1>
        <h2 class="dashboard-title">
          {{ title || $t('navigation.dashboard') }}
        </h2>
        <p v-if="description" class="dashboard-description">
          {{ description }}
        </p>
      </div>

      <div class="dashboard-header-actions">
        <div class="action-group">
          <slot name="locale-select" />
        </div>

        <div class="action-group">
          <UButton to="/settings/ai-models" :label="$t('interface.aiModels')" icon="i-lucide-sparkles" color="neutral" variant="ghost" />
          <UButton
            to="/connections"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-database"
            :label="$t('interface.connections')"
            class="action-button"
          />

          <UButton
            to="/queries"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-code"
            :label="$t('interface.sqlQueries')"
            class="action-button"
          />
        </div>

        <div class="action-group">
          <USelect
            :model-value="dashboardSelection || undefined"
            class="dashboard-selector"
            :items="dashboardSelectOptions"
            :placeholder="$t('pages.dashboard.selector.placeholder')"
            :disabled="dashboardListStatus === 'pending' || dashboards.length === 0"
            @update:model-value="onDashboardSelectionChange"
          />

          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-plus"
            :label="$t('interface.newDashboard')"
            class="action-button"
            @click="openCreateDashboardDialog"
          />

          <UButton
            v-if="hasSelectedDashboard"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-settings-2"
            :label="$t('interface.settings')"
            class="action-button"
            @click="openDashboardSettings"
          />

          <UButton
            v-if="hasSelectedDashboard"
            :color="isDashboardEditing ? 'primary' : 'neutral'"
            :variant="isDashboardEditing ? 'solid' : 'soft'"
            size="sm"
            :icon="isDashboardEditing ? 'i-lucide-check' : 'i-lucide-pen-square'"
            :label="dashboardEditActionLabel || $t('interface.edit')"
            class="action-button"
            @click="onToggleDashboardEditing"
          />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.dashboard-header {
  background: var(--color-card);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-lg) var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.dashboard-header-content {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.dashboard-header-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.dashboard-headline {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
  line-height: 1.2;
}

.dashboard-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
  line-height: 1.3;
}

.dashboard-description {
  font-size: 14px;
  color: var(--color-muted-foreground);
  margin: 0;
  line-height: 1.5;
}

.dashboard-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: center;
  justify-content: flex-end;
}

.action-group {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.action-button {
  transition: all var(--transition-fast);
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.action-button:active {
  transform: translateY(0);
}

.dashboard-selector {
  min-width: 200px;
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-header {
    padding: var(--space-md);
  }

  .dashboard-headline {
    font-size: 24px;
  }

  .dashboard-title {
    font-size: 18px;
  }

  .dashboard-header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .action-group {
    justify-content: space-between;
  }

  .dashboard-selector {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .dashboard-header {
    padding: var(--space-sm);
  }

  .dashboard-headline {
    font-size: 20px;
  }

  .dashboard-title {
    font-size: 16px;
  }

  .action-group {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }

  .action-button {
    width: 100%;
    justify-content: center;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .dashboard-header {
    background: var(--color-card);
    border-bottom-color: var(--color-border);
  }

  .dashboard-headline {
    color: #60A5FA;
  }

  .dashboard-title {
    color: #F1F5F9;
  }

  .dashboard-description {
    color: #94A3B8;
  }
}
</style>
