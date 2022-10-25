
<template>
  <Sketch class="gallery">
    <h1 class="gallery__title">Receipt</h1>
    <table v-if="tableData">
      <thead>
        <th>number</th>
        <th>price</th>
      </thead>
      <tbody>
        <tr v-for="(item, key) in tableData" :key="key">
          <td>{{ item }}</td>
        </tr>
      </tbody>
    </table>
  </Sketch>
</template>

<script setup>
import {getData} from "@/api";
import Sketch from '@/components/UI/Sketch'
import {onMounted} from "vue";

let tableData = ref(null)

onMounted(() => {
  console.log('MOUNTED')
  tableData.value = JSON.parse(getData())
  console.log(JSON.parse(tableData.value), 'TABLE DATA')
  // https://api.ipfsbrowser.com/ipfs/get.php?hash=QmPtSmraeowzZ5MdtVKAqVUh1DX992DAiKEHF8fAJAjiGW
})
</script>
