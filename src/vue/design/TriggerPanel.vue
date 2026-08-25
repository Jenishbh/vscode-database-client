<template>
  <div>
    <ux-grid v-if="designData.triggers" :data="designData.triggers" stripe style="width: 100%" :cell-style="{height: '25px'}">
      <ux-table-column align="center" field="trigger_name" title="Name" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="timing" title="Timing" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="event" title="Event" show-overflow-tooltip="true"></ux-table-column>
    </ux-grid>
    <div v-else class="design-empty">{{ designData.triggersMessage || 'Loading...' }}</div>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";
export default {
  mixins: [inject],
  data() {
    return {
      designData: { triggers: null, triggersMessage: null, dbType: null },
    };
  },
  mounted() {
    this.on("design-data", (data) => {
      this.designData = data;
    }).init();
  },
};
</script>

<style scoped>
.design-empty {
  padding: 10px 2px;
  color: var(--vscode-descriptionForeground, var(--vscode-foreground));
}
</style>
