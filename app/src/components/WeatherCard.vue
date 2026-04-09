<script setup lang="ts">
interface WeatherData {
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windGust: number
  conditions: string
  location: string
}

const props = defineProps<{ data: WeatherData }>()

const weatherEmoji: Record<string, string> = {
  'Clear sky': '☀️',
  'Mainly clear': '🌤️',
  'Partly cloudy': '⛅',
  Overcast: '☁️',
  Foggy: '🌫️',
  'Light drizzle': '🌦️',
  'Moderate drizzle': '🌧️',
  'Slight rain': '🌧️',
  'Moderate rain': '🌧️',
  'Heavy rain': '🌧️',
  'Slight snow fall': '🌨️',
  'Moderate snow fall': '❄️',
  'Heavy snow fall': '❄️',
  Thunderstorm: '⛈️',
}

const emoji = weatherEmoji[props.data.conditions] ?? '🌡️'
</script>

<template>
  <div class="weather-card">
    <div class="weather-header">
      <span class="weather-emoji">{{ emoji }}</span>
      <div>
        <div class="weather-location">{{ data.location }}</div>
        <div class="weather-conditions">{{ data.conditions }}</div>
      </div>
    </div>
    <div class="weather-temp">{{ data.temperature }}°C</div>
    <div class="weather-details">
      <div class="weather-detail">
        <span class="detail-label">Feels like</span>
        <span class="detail-value">{{ data.feelsLike }}°C</span>
      </div>
      <div class="weather-detail">
        <span class="detail-label">Humidity</span>
        <span class="detail-value">{{ data.humidity }}%</span>
      </div>
      <div class="weather-detail">
        <span class="detail-label">Wind</span>
        <span class="detail-value">{{ data.windSpeed }} km/h</span>
      </div>
      <div class="weather-detail">
        <span class="detail-label">Gusts</span>
        <span class="detail-value">{{ data.windGust }} km/h</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weather-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  color: white;
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.weather-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.weather-emoji {
  font-size: 40px;
}

.weather-location {
  font-size: 18px;
  font-weight: 600;
}

.weather-conditions {
  font-size: 13px;
  opacity: 0.85;
}

.weather-temp {
  font-size: 48px;
  font-weight: 700;
  margin: 8px 0 16px;
}

.weather-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.weather-detail {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 8px 12px;
}

.detail-label {
  display: block;
  font-size: 11px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 16px;
  font-weight: 600;
}
</style>
