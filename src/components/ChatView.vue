<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useAgUI, type FrontendToolDef, type SystemEvent } from '@/composables/useAgUI'
import WeatherCard from './WeatherCard.vue'
import CityPicker from './CityPicker.vue'

const agentUrls = [
  { label: 'Stage F-23 (proxy)', value: '/proxy/stage-f23/api/ai-agents/agent' },
  { label: 'Stage F-4 gw (proxy)', value: '/proxy/stage-f4-gw/api/ai-agents/agent' },
  { label: 'Stage F-4 (proxy)', value: '/proxy/stage-f4/api/ai-agents/agent' },
  { label: 'Local (proxy)', value: '/proxy/local/api/ai-agents/agent' },
  { label: 'Stage F-23 (direct)', value: 'http://smartcat-ai-agents-web.stage-feature-23.k9s.ya.sc.local/api/ai-agents/agent' },
  { label: 'Stage F-4 gw (direct)', value: 'http://platform-api-gateway-web.stage-feature-4.k8s.ya.sc.local/api/ai-agents/agent' },
  { label: 'Stage F-4 (direct)', value: 'http://smartcat-ai-agents-web.stage-feature-4.k9s.ya.sc.local/api/ai-agents/agent' },
  { label: 'Local (direct)', value: 'http://localhost:7601/api/ai-agents/agent' },
]

const selectedUrl = ref(localStorage.getItem('agui_url') ?? agentUrls[0].value)

function onUrlChange() {
  localStorage.setItem('agui_url', selectedUrl.value)
}

const jwtToken = ref(localStorage.getItem('agui_jwt') ?? '')
const showTokenInput = ref(!jwtToken.value)

function saveToken() {
  localStorage.setItem('agui_jwt', jwtToken.value)
  showTokenInput.value = false
}

function clearToken() {
  jwtToken.value = ''
  localStorage.removeItem('agui_jwt')
  showTokenInput.value = true
}

const cookieValue = ref(localStorage.getItem('agui_cookie') ?? '')
const showCookieInput = ref(!cookieValue.value)

function saveCookie() {
  localStorage.setItem('agui_cookie', cookieValue.value)
  document.cookie = `AccessToken=${cookieValue.value}; path=/`
  showCookieInput.value = false
}

function clearCookie() {
  cookieValue.value = ''
  localStorage.removeItem('agui_cookie')
  document.cookie = 'AccessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  showCookieInput.value = true
}

if (cookieValue.value) {
  document.cookie = `AccessToken=${cookieValue.value}; path=/`
}

const selectCityToolDef: FrontendToolDef = {
  name: 'select-city',
  description:
    'Presents an interactive city picker so the user can select a city for weather lookup.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Message to display above the city picker' },
    },
    required: ['prompt'],
  },
}

const { messages, streamingText, isRunning, error, toolCalls, timeline, sendMessage, abort } = useAgUI({
  url: selectedUrl,
  token: jwtToken,
  frontendTools: [selectCityToolDef],
})

const inputText = ref('')
const chatContainer = ref<HTMLElement | null>(null)
const citySelected = ref(false)

const weatherResults = computed(() => {
  const results: { id: string; data: Record<string, unknown> }[] = []
  for (const [id, tc] of toolCalls.value) {
    if (!tc.result) continue
    try {
      const parsed = JSON.parse(tc.result)
      if (parsed && typeof parsed.temperature === 'number' && parsed.location) {
        results.push({ id, data: parsed })
      }
    } catch {
      // ignore parse errors
    }
  }
  return results
})

const cityPickerData = computed(() => {
  for (const [, tc] of toolCalls.value) {
    if (!tc.result) continue
    try {
      const parsed = JSON.parse(tc.result)
      if (parsed?.awaitingSelection && Array.isArray(parsed.cities)) {
        return parsed as {
          cities: { name: string; country: string; emoji: string }[]
          prompt: string
          awaitingSelection: boolean
        }
      }
    } catch {
      // ignore
    }
  }
  return null
})

const activeToolNames = computed(() => {
  const names: string[] = []
  for (const [, tc] of toolCalls.value) {
    if (tc.isRunning && !/^transfer/i.test(tc.name)) names.push(tc.name)
  }
  return names
})

function eventIcon(type: SystemEvent['type']): string {
  switch (type) {
    case 'handoff': return '🔀'
    case 'tool_call': return '🔧'
    case 'tool_result': return '📋'
    case 'run': return '▶'
    case 'error': return '❌'
    case 'text': return '💬'
    case 'state': return '📊'
    default: return '📡'
  }
}

function handleCitySelect(city: string) {
  citySelected.value = true
  sendMessage(`I choose ${city}`)
}

async function handleSubmit() {
  if (!inputText.value.trim()) return
  const text = inputText.value
  inputText.value = ''
  citySelected.value = false
  await sendMessage(text)
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

watch([timeline, streamingText, toolCalls], scrollToBottom)
</script>

<template>
  <div class="chat-app">
    <header class="chat-header">
      <div class="header-top">
        <h1>AG-UI Chat</h1>
        <div class="header-controls">
          <select v-model="selectedUrl" class="url-select" @change="onUrlChange">
            <option v-for="u in agentUrls" :key="u.value" :value="u.value">{{ u.label }}</option>
          </select>
          <button
            class="token-toggle"
            :class="{ 'token-toggle--active': !!jwtToken && !showTokenInput }"
            @click="showTokenInput = !showTokenInput"
          >
            {{ jwtToken && !showTokenInput ? 'JWT set' : 'JWT' }}
          </button>
          <button
            class="token-toggle"
            :class="{ 'token-toggle--active': !!cookieValue && !showCookieInput }"
            @click="showCookieInput = !showCookieInput"
          >
            {{ cookieValue && !showCookieInput ? 'Cookie set' : 'Cookie' }}
          </button>
        </div>
      </div>
      <div v-if="showTokenInput" class="token-bar">
        <input
          v-model="jwtToken"
          type="password"
          placeholder="Paste JWT token..."
          class="token-input"
          @keydown.enter="saveToken"
        />
        <button class="btn btn--token" @click="saveToken" :disabled="!jwtToken.trim()">Save</button>
        <button v-if="jwtToken" class="btn btn--clear" @click="clearToken">Clear</button>
      </div>
      <div v-if="showCookieInput" class="token-bar">
        <input
          v-model="cookieValue"
          type="password"
          placeholder="Paste AccessToken cookie value..."
          class="token-input"
          @keydown.enter="saveCookie"
        />
        <button class="btn btn--token" @click="saveCookie" :disabled="!cookieValue.trim()">Save</button>
        <button v-if="cookieValue" class="btn btn--clear" @click="clearCookie">Clear</button>
      </div>
    </header>

    <div ref="chatContainer" class="chat-messages">
      <div v-if="timeline.length === 0 && !streamingText" class="empty-state">
        <div class="empty-icon">💬</div>
        <p>Start a conversation</p>
        <div class="suggestions">
          <button class="suggestion-btn" @click="sendMessage('Hello!')">
            Hello!
          </button>
        </div>
      </div>

      <template v-for="item in timeline" :key="item.kind === 'message' ? item.message.id : item.event.id">
        <!-- User / Assistant message -->
        <div v-if="item.kind === 'message'" :class="['message', `message--${item.message.role}`]">
          <div class="message-avatar">
            {{ item.message.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="message-content">
            {{ item.message.content }}
          </div>
        </div>

        <!-- System event -->
        <div v-else :class="['system-event', `system-event--${item.event.type}`]">
          <details v-if="item.event.detail" class="event-details">
            <summary class="event-summary">
              <span class="event-icon">{{ eventIcon(item.event.type) }}</span>
              <span class="event-label">{{ item.event.summary }}</span>
            </summary>
            <pre class="event-detail-content">{{ item.event.detail }}</pre>
          </details>
          <div v-else class="event-compact">
            <span class="event-icon">{{ eventIcon(item.event.type) }}</span>
            <span class="event-label">{{ item.event.summary }}</span>
          </div>
        </div>
      </template>

      <div v-for="tc in activeToolNames" :key="tc" class="tool-indicator">
        <div class="spinner" />
        <span>Calling {{ tc }}…</span>
      </div>

      <div v-if="cityPickerData && !citySelected" class="picker-area">
        <CityPicker
          :cities="cityPickerData.cities"
          :prompt="cityPickerData.prompt"
          :disabled="isRunning"
          @select="handleCitySelect"
        />
      </div>

      <div v-for="wr in weatherResults" :key="wr.id" class="weather-result">
        <WeatherCard :data="wr.data as any" />
      </div>

      <div v-if="streamingText" class="message message--assistant">
        <div class="message-avatar">🤖</div>
        <div class="message-content streaming">
          {{ streamingText }}<span class="cursor-blink">|</span>
        </div>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <form class="chat-input-area" @submit.prevent="handleSubmit">
      <input
        v-model="inputText"
        type="text"
        placeholder="Type a message…"
        :disabled="isRunning"
        class="chat-input"
      />
      <button v-if="isRunning" type="button" class="btn btn--abort" @click="abort">Stop</button>
      <button v-else type="submit" class="btn btn--send" :disabled="!inputText.trim()">Send</button>
    </form>
  </div>
</template>

<style scoped>
.chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 720px;
  margin: 0 auto;
  background: #f8f9fb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.chat-header {
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-header h1 {
  margin: 0;
  font-size: 20px;
  color: #111827;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-select {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}

.url-select:focus {
  border-color: #667eea;
}

.token-toggle {
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.token-toggle:hover {
  border-color: #667eea;
  color: #667eea;
}

.token-toggle--active {
  background: #eef2ff;
  border-color: #667eea;
  color: #4f46e5;
}

.token-bar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.token-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
  transition: border-color 0.15s;
}

.token-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn--token {
  background: #667eea;
  color: white;
  padding: 8px 14px;
  font-size: 12px;
}

.btn--clear {
  background: #f3f4f6;
  color: #6b7280;
  padding: 8px 14px;
  font-size: 12px;
}

.btn--clear:hover {
  background: #e5e7eb;
  color: #374151;
}

/* ─── Chat area ─── */

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6b7280;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.suggestion-btn {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 10px 18px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.15s;
}

.suggestion-btn:hover {
  background: #f3f4f6;
  border-color: #667eea;
  color: #667eea;
}

/* ─── Messages ─── */

.message {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.message--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message--assistant {
  align-self: flex-start;
}

.message-avatar {
  font-size: 24px;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-content {
  padding: 10px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.message--user .message-content {
  background: #667eea;
  color: white;
  border-bottom-right-radius: 4px;
}

.message--assistant .message-content {
  background: white;
  color: #1f2937;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
}

.streaming {
  min-height: 1.5em;
}

.cursor-blink {
  animation: blink 0.8s infinite;
  color: #667eea;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* ─── System events ─── */

.system-event {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
  border-left: 3px solid;
  align-self: stretch;
}

.system-event--handoff {
  background: #ede9fe;
  border-left-color: #7c3aed;
  color: #5b21b6;
}

.system-event--tool_call {
  background: #ecfdf5;
  border-left-color: #059669;
  color: #065f46;
}

.system-event--tool_result {
  background: #ecfdf5;
  border-left-color: #10b981;
  color: #065f46;
}

.system-event--run {
  background: #f3f4f6;
  border-left-color: #9ca3af;
  color: #6b7280;
}

.system-event--error {
  background: #fef2f2;
  border-left-color: #ef4444;
  color: #dc2626;
}

.system-event--text {
  background: #f9fafb;
  border-left-color: #d1d5db;
  color: #9ca3af;
}

.system-event--state {
  background: #fffbeb;
  border-left-color: #f59e0b;
  color: #92400e;
}

.system-event--info {
  background: #f3f4f6;
  border-left-color: #d1d5db;
  color: #6b7280;
}

.event-details {
  cursor: pointer;
}

.event-details[open] .event-summary {
  margin-bottom: 4px;
}

.event-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  user-select: none;
  list-style: none;
}

.event-summary::-webkit-details-marker {
  display: none;
}

.event-summary::before {
  content: '▸';
  font-size: 10px;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.event-details[open] > .event-summary::before {
  transform: rotate(90deg);
}

.event-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}

.event-icon {
  flex-shrink: 0;
  font-size: 13px;
}

.event-label {
  font-weight: 500;
}

.event-detail-content {
  margin: 4px 0 0 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-size: 11px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
}

/* ─── Tool indicator ─── */

.tool-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #eef2ff;
  border-radius: 12px;
  font-size: 13px;
  color: #4f46e5;
  align-self: flex-start;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #c7d2fe;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.picker-area {
  align-self: flex-start;
  margin-left: 46px;
}

.weather-result {
  align-self: flex-start;
  margin-left: 46px;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 13px;
  border: 1px solid #fecaca;
}

/* ─── Input area ─── */

.chat-input-area {
  display: flex;
  gap: 10px;
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e5e7eb;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.chat-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input:disabled {
  background: #f3f4f6;
}

.btn {
  padding: 12px 20px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn--send {
  background: #667eea;
  color: white;
}

.btn--send:hover:not(:disabled) {
  background: #5a6fd6;
}

.btn--send:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn--abort {
  background: #ef4444;
  color: white;
}

.btn--abort:hover {
  background: #dc2626;
}
</style>
