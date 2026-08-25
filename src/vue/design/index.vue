<template>
  <div class="mt-2">
    <el-button @click="init" type="success" title="Refresh"  size="mini" >Refresh </el-button>
    <el-tag>Table:</el-tag>
    {{table}}
    <InfoPanel />
    <ul class="tab">
      <li class="tab__item " :class="{'tab__item--active':activePanel=='ddl'}" @click="activePanel='ddl'">DDL </li>
      <li class="tab__item " :class="{'tab__item--active':activePanel=='column'}" @click="activePanel='column'">Column </li>
      <li class="tab__item " :class="{'tab__item--active':activePanel=='foreignKey'}" @click="activePanel='foreignKey'">Foreign Key </li>
      <li class="tab__item " :class="{'tab__item--active':activePanel=='index'}" @click="activePanel='index'">Index </li>
      <li class="tab__item " :class="{'tab__item--active':activePanel=='trigger'}" @click="activePanel='trigger'">Trigger </li>
      <li class="tab__item " :class="{'tab__item--active':activePanel=='check'}" @click="activePanel='check'">Check </li>
    </ul>
    <div class="mt-2">
      <DdlPanel v-if="activePanel=='ddl'" />
      <ColumnPanel v-if="activePanel=='column'" />
      <ForeignKeyPanel v-if="activePanel=='foreignKey'" />
      <IndexPanel v-if="activePanel=='index'" />
      <TriggerPanel v-if="activePanel=='trigger'" />
      <CheckPanel v-if="activePanel=='check'" />
    </div>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";
import IndexPanel from "./IndexPanel";
import ColumnPanel from "./ColumnPanel";
import InfoPanel from "./InfoPanel";
import DdlPanel from "./DdlPanel";
import ForeignKeyPanel from "./ForeignKeyPanel";
import TriggerPanel from "./TriggerPanel";
import CheckPanel from "./CheckPanel";
export default {
  mixins: [inject],
  components: { IndexPanel, ColumnPanel, InfoPanel, DdlPanel, ForeignKeyPanel, TriggerPanel, CheckPanel },
  data() {
    return {
      table: null,
      activePanel: "column",
    };
  },
  mounted() {
    this.on("design-data", (data) => {
      this.table = data.table;
    });
  },
};
</script>

<style scoped>
.tab {
  border-bottom: 1px solid var(--vscode-dropdown-border);
  display: flex;
  padding: 0;
}

.tab__item {
  list-style: none;
  cursor: pointer;
  font-size: var(--vscode-font-size);
  padding: 7px 10px;
  color: var(--vscode-foreground);
  border-bottom: 1px solid transparent;
}

.tab__item:hover {
  color: var(--vscode-panelTitle-activeForeground);
}

.tab__item--active {
  color: var(--vscode-panelTitle-activeForeground);
  border-bottom-color: var(--vscode-panelTitle-activeForeground);
}

</style>
