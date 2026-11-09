<script>
import component from '~/view-models/pages/connections/new'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('connections.new.headline')"
      :title="t('connections.new.title')"
      :description="t('connections.new.description')"
     />

    <UPageBody>
      <UPageCard>
        <ConectionTestForm />
      </UPageCard>
    </UPageBody>
  </UPage>
</template>
