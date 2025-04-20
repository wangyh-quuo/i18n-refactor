<template>
  <div>
    <h1>{{ $t('home.key_2') }}</h1>
    <p>{{ $t('home.key_3') }}</p>
    <el-button>不看</el-button>
    <div>{{ $t('home.key_6') }}</div>
    <div>{{ $t('home.key_7') }}</div>
    <div>{{ $t('home.key_8') }}</div>
  </div>
</template>

<script setup>
// 没有中文
const x = ref(t('home.key_8'))

const options = [{
  label: t('home.key_4'),
  value: 1
}]
</script>
