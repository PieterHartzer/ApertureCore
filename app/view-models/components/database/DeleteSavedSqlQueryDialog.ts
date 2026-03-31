import { computed, defineComponent, ref, watch } from 'vue'

import AppAlert from '~/components/ui/AppAlert.vue'

export default defineComponent({
  components: {
    AppAlert
  },
  props: {
    open: {
      type: Boolean,
      required: true
    },
    queryName: {
      type: String,
      required: true
    },
    isDeleting: {
      type: Boolean,
      default: false
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  emits: ['update:open', 'confirm'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const confirmationName = ref('')

    const isConfirmationMatch = computed(() => {
      return confirmationName.value.trim() === props.queryName
    })

    const resetForm = () => {
      confirmationName.value = ''
    }

    watch(
      () => props.open,
      (open) => {
        if (open) {
          resetForm()
        }
      }
    )

    watch(
      () => props.queryName,
      () => {
        if (props.open) {
          resetForm()
        }
      }
    )

    const closeDialog = () => {
      if (props.isDeleting) {
        return
      }

      emit('update:open', false)
    }

    const onConfirm = () => {
      if (!isConfirmationMatch.value || props.isDeleting) {
        return
      }

      emit('confirm', {
        confirmationName: confirmationName.value.trim()
      })
    }

    return {
      closeDialog,
      confirmationName,
      emit,
      isConfirmationMatch,
      onConfirm,
      t
    }
  }
})
