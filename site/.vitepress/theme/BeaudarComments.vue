<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  repo: string
  branch: string
  dark: boolean
}>()

const container = ref<HTMLElement | null>(null)

function themeName() {
  return props.dark ? 'github-dark' : 'github-light'
}

async function mountComments() {
  await nextTick()
  if (!container.value || !props.repo) return
  container.value.replaceChildren()
  const script = document.createElement('script')
  script.src = 'https://beaudar.lipk.org/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  script.setAttribute('repo', props.repo)
  script.setAttribute('branch', props.branch || 'master')
  script.setAttribute('issue-term', 'pathname')
  script.setAttribute('theme', themeName())
  container.value.appendChild(script)
}

function syncTheme() {
  const iframe = container.value?.querySelector<HTMLIFrameElement>('.beaudar-frame')
  iframe?.contentWindow?.postMessage({ type: 'set-theme', theme: themeName() }, 'https://beaudar.lipk.org')
}

onMounted(mountComments)
onBeforeUnmount(() => container.value?.replaceChildren())
watch(() => [props.repo, props.branch], mountComments)
watch(() => props.dark, syncTheme)
</script>

<template>
  <section class="article-comments" aria-label="文章评论">
    <p class="eyebrow">COMMENTS</p>
    <h2>评论</h2>
    <div ref="container" class="beaudar-container"></div>
  </section>
</template>
