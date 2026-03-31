import { defineComponent } from 'vue'

import ConectionTestForm from '~/components/database/ConectionTestForm.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'

export default defineComponent({
  components: {
    AppLocaleSelect,
    ConectionTestForm
  },
  setup() {
    const { t } = useI18n()

    return {
      t
    }
  }
})
