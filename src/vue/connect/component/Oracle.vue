<template>
  <section class="mb-2" v-if="connectionOption.dbType == 'Oracle'">
    <div class="inline-block mr-10">
      <label class="inline-block w-32 mr-5 font-bold">
        Service Name
        <span class="mr-1 text-red-600" title="required">*</span>
      </label>
      <input
        class="w-64 field__input"
        placeholder="e.g. FREEPDB1 or XEPDB1"
        title="The Oracle service name (or SID) to connect to. This is the part after the slash in host:port/service."
        v-model="connectionOption.serviceName"
      />
    </div>
    <span> (Schemas are Oracle users; each appears as a database in the tree) </span>
  </section>
</template>

<script>
export default {
  props: ["connectionOption"],
};
</script>

<style></style>
