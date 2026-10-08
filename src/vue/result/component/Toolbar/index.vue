<template>
  <div class="toolbar">
    <el-button v-if="showFullBtn" @click="()=>$emit('sendToVscode','full')" type="primary" title="Full Result View" icon="el-icon-rank" size="mini" circle>
    </el-button>
    <el-input v-model="searchInput" size="mini" placeholder="Input To Search Data" style="width:200px" :clearable="true" />
    <el-button icon="icon-github" title="Star the project to represent support." @click='()=>$emit("sendToVscode", "openGithub")'></el-button>
    <el-button icon="el-icon-circle-plus-outline" @click="$emit('insert')" title="Insert a row using a form"></el-button>
    <el-button icon="el-icon-plus" @click="$emit('addRow')" title="Add an empty row to the grid and type into it, then press Apply"></el-button>
    <el-button icon="el-icon-delete" style="color:#f56c6c" @click="$emit('deleteConfirm');" title="delete"></el-button>
    <el-button icon="el-icon-bottom" @click="$emit('export');" style="color:#4ba3ff;" title="Export"></el-button>
    <el-button icon="el-icon-caret-right" title="Run the statement above and reload. This never applies your edits." style="color: #54ea54;margin-left:0;" @click="$emit('run');"></el-button>
    <el-button icon="el-icon-check" :disabled="!pendingEdits" @click="$emit('applyEdits')"
      :style="pendingEdits ? 'color:#67c23a;font-weight:bold' : ''"
      :title="pendingEdits ? `Apply ${pendingEdits} edited row(s) to the database` : 'No edits to apply'">{{ pendingEdits ? ' ' + pendingEdits : '' }}</el-button>
    <el-button icon="el-icon-refresh-left" :disabled="!pendingEdits" @click="$emit('revertEdits')"
      :title="pendingEdits ? 'Discard the edits and reload from the database' : 'No edits to discard'"></el-button>
    <el-button v-if="activeFilters" @click="$emit('clearFilters')" size="mini"
      style="color:#e6a23c;margin-left:8px"
      :title="`Remove the filter on ${activeFilters} column(s)`">Clear filters</el-button>
    <SegmentedControl :value="viewMode" @input="$emit('update:viewMode',$event)" :options="viewModeOptions" style="margin-left:8px;vertical-align:middle;" title="Grid View Mode" />
    <div style="display:inline-block;font-size:14px;padding-left: 8px;" class="el-pagination__total">
      Cost: {{costTime}}ms
    </div>
    <div style="display:inline-block">
      <el-pagination @size-change="changePageSize" @current-change="page=>$emit('changePage',page,true)" @next-click="()=>$emit('changePage',1)" @prev-click="()=>$emit('changePage',-1)" :current-page.sync="page.pageNum" :small="true" :page-size="page.pageSize"  :layout="page.total!=null?'prev,pager, next, total':'prev, next'" :total="page.total">
      </el-pagination>
    </div>
  </div>
</template>

<script>
import SegmentedControl from "../SegmentedControl.vue";
export default {
  components: { SegmentedControl },
  props: ["costTime", "search", "showFullBtn", "page", "viewMode", "pendingEdits", "activeFilters"],
  data() {
    return {
      searchInput: null,
      viewModeOptions: [
        { label: "Default", value: "default" },
        { label: "Reverse", value: "reverse" },
        { label: "JSON", value: "json" },
      ],
    };
  },
  methods: {
    changePageSize(size) {
      this.page.pageSize = size;
      vscodeEvent.emit("changePageSize", size);
      this.changePage(0);
    },
  },
  watch: {
    searchInput: function () {
      this.$emit("update:search", this.searchInput); // pass the child input value up; the parent binds it with .sync
    },
  },
};
</script>

<style scoped>
.toolbar {
  margin-top: 3px;
  margin-bottom: 3px;
}

.el-button--mini.is-circle {
  padding: 6px;
}

.el-button--default {
  padding: 0;
  border: none;
  font-size: 19px;
  margin-left: 7px;
}

.el-button:focus{
  color: inherit !important;
  background-color: var(--vscode-editor-background);
}

.el-button:hover {
  color: #409eff !important;
  border-color: #c6e2ff;
  background-color: var(--vscode-editor-background);
}

.el-pagination {
  padding: 0;
}
>>> .el-input{
  bottom: 2px;
}
>>> .el-input--mini .el-input__inner{
  height: 24px;
}

</style>

<style>
.el-pagination span,.el-pagination li,
.btn-prev i,.btn-next i{
  line-height: 27px !important;
}
</style>