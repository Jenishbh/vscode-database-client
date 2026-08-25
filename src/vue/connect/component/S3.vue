<template>
  <div class="mt-5">
    <section class="mb-2">
      <div class="inline-block mr-10">
        <label class="inline-block w-32 mr-5 font-bold">
          <span>Endpoint</span>
          <span class="mr-1 text-red-600" title="required">*</span>
        </label>
        <input
          class="field__input"
          style="width: 28rem"
          placeholder="http://127.0.0.1:9000"
          required
          v-model="endpoint"
        />
      </div>
    </section>
    <section class="mb-2">
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block w-32 mr-5 font-bold">
          Access Key
          <span class="mr-1 text-red-600" title="required">*</span>
        </label>
        <input class="w-64 field__input" placeholder="Access Key" required v-model="connectionOption.s3AccessKey" />
      </div>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block w-32 mr-5 font-bold">Secret Key</label>
        <input
          class="w-64 field__input"
          placeholder="Secret Key"
          type="password"
          v-model="connectionOption.s3SecretKey"
        />
      </div>
    </section>
    <section class="mb-2">
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block w-32 mr-5 font-bold">Region</label>
        <input class="w-64 field__input" placeholder="us-east-1" v-model="connectionOption.s3Region" />
      </div>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block mr-5 font-bold">Force Path Style</label>
        <el-switch v-model="connectionOption.s3ForcePathStyle"></el-switch>
        <span class="ml-2 text-xs opacity-75">(required for MinIO and most non-AWS endpoints)</span>
      </div>
    </section>
    <div class="inline-block mb-2 mr-10">
      <label class="inline-block w-32 mr-5 font-bold">Connection Timeout</label>
      <input class="w-64 field__input" placeholder="10000" v-model="connectionOption.connectTimeout" />
    </div>
  </div>
</template>

<script>
export default {
  props: ["connectionOption"],
  computed: {
    // mirrored onto host so getConnectId()/status bar have something to show;
    // s3Endpoint stays the field the S3 driver actually reads from.
    endpoint: {
      get() {
        return this.connectionOption.s3Endpoint;
      },
      set(value) {
        this.connectionOption.s3Endpoint = value;
        this.connectionOption.host = value;
      },
    },
  },
};
</script>

<style></style>
