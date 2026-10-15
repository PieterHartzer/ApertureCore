<script>
import component from '~/view-models/components/ui/AppAlert'

export default component
</script>

<template>
  <div
    role="alert"
    class="alert-container"
    :class="[
      `alert-${tone.color}`,
      { 'alert-dismissible': hasClose }
    ]"
  >
    <div class="alert-content">
      <UIcon
        v-if="tone.icon"
        :name="tone.icon"
        class="alert-icon"
        :class="`alert-icon-${tone.color}`"
      />
      <div class="alert-text">
        <h3 v-if="title" class="alert-title">
          {{ title }}
        </h3>
        <slot />
      </div>
    </div>
    <button
      v-if="hasClose"
      type="button"
      class="alert-close"
      :aria-label="t('components.ui.appAlert.close')"
      @click="$emit('close')"
    >
      <UIcon
        name="i-lucide-x"
        class="alert-close-icon"
      />
    </button>
  </div>
</template>

<style scoped>
.alert-container {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.alert-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  flex: 1;
}

.alert-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.alert-text {
  font-size: 14px;
  line-height: 1.5;
}

.alert-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.alert-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color var(--transition-fast);
}

.alert-close:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.alert-close-icon {
  width: 16px;
  height: 16px;
}

/* Success Alert */
.alert-success {
  background-color: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
}

.alert-success .alert-icon-success {
  color: #10B981;
}

.alert-success .alert-title {
  color: #065F46;
}

/* Error Alert */
.alert-error {
  background-color: rgba(220, 38, 38, 0.05);
  border-color: rgba(220, 38, 38, 0.3);
}

.alert-error .alert-icon-error {
  color: #DC2626;
}

.alert-error .alert-title {
  color: #991B1B;
}

/* Warning Alert */
.alert-warning {
  background-color: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.3);
}

.alert-warning .alert-icon-warning {
  color: #F59E0B;
}

.alert-warning .alert-title {
  color: #92400E;
}

/* Info Alert */
.alert-info {
  background-color: rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.3);
}

.alert-info .alert-icon-info {
  color: #3B82F6;
}

.alert-info .alert-title {
  color: #1E40AF;
}

/* Responsive */
@media (max-width: 640px) {
  .alert-container {
    padding: var(--space-sm);
  }
  
  .alert-title {
    font-size: 13px;
  }
  
  .alert-text {
    font-size: 13px;
  }
}
</style>
