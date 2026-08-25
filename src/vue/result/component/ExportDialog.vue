<template>
  <el-dialog :title="'Export Option'" :visible="visible" width="30%" top="3vh" size="mini" @close="$emit('update:visible',false)">
    <el-form :model="exportOption" label-width="180px">
      <el-form-item label="Type">
        <SegmentedControl v-model="exportOption.type" :options="typeOptions" />
      </el-form-item>
      <el-form-item label="Remove Pagination SQL">
        <el-switch v-model="exportOption.withOutLimit"></el-switch>
      </el-form-item>
      <el-form-item label="Output SQL to separate sheet">
        <el-switch v-model="exportOption.sheetSql" :disabled="exportOption.type!=='xlsx'"></el-switch>
      </el-form-item>
    </el-form>
    <span slot="footer" class="dialog-footer">
      <el-button @click="$emit('update:visible',false)">Close</el-button>
      <el-button :loading="loading" :disabled="exportOption.type==='xlsx'" title="Xlsx cannot be opened as an editor tab" @click="loading=true;$emit('exportHandle',{...exportOption,openInEditor:true});">Export To Editor</el-button>
      <el-button type="primary" :loading="loading" @click="loading=true;$emit('exportHandle',{...exportOption,openInEditor:false});">Export</el-button>
    </span>
  </el-dialog>
</template>

<script>
import SegmentedControl from "./SegmentedControl.vue";
export default {
  components: { SegmentedControl },
  props: ["visible"],
  data() {
    return {
      loading: false,
      typeOptions: [
        { label: "XLSX", value: "xlsx" },
        { label: "CSV", value: "csv" },
        { label: "JSON", value: "json" },
        { label: "SQL", value: "sql" },
        { label: "Markdown", value: "md" },
      ],
      exportOption: {
        withOutLimit: true,
        sheetSql: false,
        type: "xlsx",
      },
    }
  },
  watch:{
    visible(){
      this.loading=false;
    }
  }
}
</script>

<style>
</style>