<script>
export default {
  name: 'KPICard',
  props: {
    title: {
      type: String,
      required: true
    },
    value: {
      type: [String, Number],
      required: true
    },
    trend: {
      type: Number,
      default: null
    },
    trendLabel: {
      type: String,
      default: ''
    },
    icon: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: Boolean,
      default: false
    },
    errorText: {
      type: String,
      default: ''
    }
  },
  emits: ['refresh'],
  setup(props, { emit }) {
    const isPositiveTrend = computed(() => {
      return props.trend !== null && props.trend >= 0
    })

    const trendIcon = computed(() => {
      if (props.trend === null) return ''
      return isPositiveTrend.value ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
    })

    return { isPositiveTrend, trendIcon }
  }
}
</script>

<template>
  <div
    class="kpi-card"
    :class="{
      'kpi-card-loading': loading,
      'kpi-card-error': error
    }"
  >
    <div class="kpi-card-header">
      <div class="kpi-card-icon" v-if="icon && !loading && !error">
        <UIcon :name="icon" />
      </div>
      <div class="kpi-card-title">{{ title }}</div>
      <button
        v-if="!loading && !error"
        type="button"
        class="kpi-card-refresh"
        :aria-label="'Refresh ' + title"
        @click="$emit('refresh')"
      >
        <UIcon name="i-lucide-rotate-cw" />
      </button>
    </div>

    <div class="kpi-card-value">
      <template v-if="loading">
        <div class="kpi-value-skeleton"></div>
      </template>
      <template v-else-if="error">
        <span class="kpi-value-error">{{ errorText || 'Error loading data' }}</span>
      </template>
      <template v-else>
        <span class="kpi-value">{{ value }}</span>
      </template>
    </div>

    <div v-if="!loading && !error && (trend !== null || trendLabel)" class="kpi-card-footer">
      <div
        v-if="trend !== null"
        class="kpi-trend"
        :class="{ 'kpi-trend-positive': isPositiveTrend, 'kpi-trend-negative': !isPositiveTrend }"
      >
        <UIcon
          v-if="trendIcon"
          :name="trendIcon"
          class="kpi-trend-icon"
        />
        <span class="kpi-trend-value">
          {{ Math.abs(trend) }}%
        </span>
      </div>
      <span v-if="trendLabel" class="kpi-trend-label">{{ trendLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.kpi-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.kpi-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

.kpi-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.kpi-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 8px;
}

.kpi-card-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.kpi-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kpi-card-refresh {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  border-radius: 6px;
  transition: all var(--transition-fast);
}

.kpi-card-refresh:hover {
  background: var(--color-muted);
  color: var(--color-primary);
}

.kpi-card-refresh:active {
  transform: scale(0.95);
}

.kpi-card-refresh :deep(svg) {
  width: 18px;
  height: 18px;
}

.kpi-card-value {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
}

.kpi-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.kpi-value-skeleton {
  width: 120px;
  height: 48px;
  background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-border) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.kpi-value-error {
  font-size: 16px;
  color: var(--color-destructive);
  font-weight: 500;
}

.kpi-card-footer {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border);
}

.kpi-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 16px;
  transition: all var(--transition-fast);
}

.kpi-trend-positive {
  color: #10B981;
  background-color: rgba(16, 185, 129, 0.1);
}

.kpi-trend-negative {
  color: #DC2626;
  background-color: rgba(220, 38, 38, 0.1);
}

.kpi-trend-icon {
  width: 16px;
  height: 16px;
}

.kpi-trend-value {
  font-size: 14px;
  font-weight: 600;
}

.kpi-trend-label {
  font-size: 13px;
  color: var(--color-muted-foreground);
}

/* Loading State */
.kpi-card-loading {
  opacity: 0.7;
  pointer-events: none;
}

/* Error State */
.kpi-card-error {
  border-color: var(--color-destructive);
  background-color: rgba(220, 38, 38, 0.05);
}

/* Responsive */
@media (max-width: 640px) {
  .kpi-card {
    padding: var(--space-md);
  }

  .kpi-value {
    font-size: 24px;
  }

  .kpi-card-title {
    font-size: 12px;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .kpi-card {
    background: var(--color-card);
    border-color: var(--color-border);
  }

  .kpi-value {
    color: #60A5FA;
  }

  .kpi-card-title {
    color: #94A3B8;
  }
}
</style>
