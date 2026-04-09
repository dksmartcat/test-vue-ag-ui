<script setup lang="ts">
import { ref } from 'vue'

interface City {
  name: string
  country: string
  emoji: string
}

const props = defineProps<{
  cities: City[]
  prompt: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [city: string]
}>()

const selectedCity = ref<string | null>(null)

function handleSelect(city: City) {
  if (props.disabled) return
  selectedCity.value = city.name
  emit('select', city.name)
}
</script>

<template>
  <div class="city-picker">
    <div class="picker-header">
      <span class="picker-icon">📍</span>
      <span class="picker-prompt">{{ prompt }}</span>
    </div>
    <div class="city-grid">
      <button
        v-for="city in cities"
        :key="city.name"
        class="city-btn"
        :class="{
          'city-btn--selected': selectedCity === city.name,
          'city-btn--disabled': disabled && selectedCity !== city.name,
        }"
        :disabled="disabled && selectedCity !== city.name"
        @click="handleSelect(city)"
      >
        <span class="city-emoji">{{ city.emoji }}</span>
        <span class="city-name">{{ city.name }}</span>
        <span class="city-country">{{ city.country }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.city-picker {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  max-width: 480px;
}

.picker-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.picker-icon {
  font-size: 20px;
}

.city-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.city-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.city-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #eef2ff;
}

.city-btn--selected {
  border-color: #667eea;
  background: #eef2ff;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.city-btn--disabled {
  opacity: 0.4;
  cursor: default;
}

.city-emoji {
  font-size: 22px;
  flex-shrink: 0;
}

.city-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.city-country {
  font-size: 11px;
  color: #6b7280;
  margin-left: auto;
}
</style>
