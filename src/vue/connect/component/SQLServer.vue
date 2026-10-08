<template>
  <!-- The parent only renders this for SqlServer, so nothing here re-checks it. -->
  <div>
    <section class="mb-2">
      <div class="inline-block mr-10">
        <label class="inline-block w-32 mr-5 font-bold">Instance Name</label>
        <input
          class="w-64 field__input"
          placeholder="Named instance (optional)"
          title="The instance name to connect to. The SQL Server Browser service must be running on the database server, and UDP port 1434 on the database server must be reachable."
          v-model="connectionOption.instanceName"
        />
      </div>
      <span class="hint">Set this and the Port above is ignored.</span>
    </section>

    <section class="mb-2">
      <div class="inline-block mr-10">
        <label class="inline-block w-32 mr-5 font-bold">Auth Type</label>
        <el-select v-model="connectionOption.authType">
          <el-option label="SQL Login" value="default"></el-option>
          <el-option label="Windows (NTLM)" value="ntlm"></el-option>
        </el-select>
      </div>
      <div class="inline-block mr-10">
        <label class="inline-block mr-5 font-bold w-18">Encrypt</label>
        <el-switch v-model="connectionOption.encrypt"></el-switch>
      </div>
      <div class="inline-block mr-10">
        <label
          class="inline-block mr-5 font-bold"
          title="Accept a self-signed server certificate. Turn this off to validate the server certificate chain."
        >Trust Server Certificate</label>
        <el-switch v-model="connectionOption.trustServerCertificate"></el-switch>
      </div>
    </section>

    <section class="mb-2" v-if="connectionOption.authType == 'ntlm'">
      <div class="inline-block mr-10">
        <label class="inline-block w-32 mr-5 font-bold">
          Domain
          <span class="mr-1 text-red-600" title="required">*</span>
        </label>
        <input
          class="w-64 field__input"
          placeholder="e.g. CORP"
          title="The Windows domain of the account, without the backslash."
          required
          v-model="connectionOption.domain"
        />
      </div>
      <div class="hint hint--block">
        Signs in as the account below, not as the Windows user running VS Code,
        so Username and Password are still needed. Split the account across the
        fields: <code>CORP\alice</code> is Domain <code>CORP</code>,
        Username <code>alice</code>.
      </div>
    </section>
  </div>
</template>

<script>
export default {
  props: ["connectionOption"],
};
</script>

<style scoped>
.hint {
  opacity: 0.75;
  font-size: 12px;
}

.hint--block {
  display: block;
  margin-top: 6px;
  max-width: 760px;
  line-height: 1.5;
}
</style>
