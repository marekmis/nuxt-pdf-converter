<template>
  <div class="min-h-screen bg-gray-900 py-12">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-100 mb-4">
          PDF to JPG Converter
        </h1>
        <p class="text-lg text-gray-400">
          Convert PDF pages to high-quality JPGs — merged into one image or as individual files
        </p>
      </div>

      <!-- Main Card -->
      <UCard class="p-8">
        <div class="space-y-6">
          <!-- Upload Area -->
          <div v-if="!isProcessing && !downloadFiles.length">
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Select PDF Files
              </label>

              <div
                @drop="handleDrop"
                @dragover.prevent
                @dragenter.prevent
                class="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
                :class="{ 'border-primary-500 bg-primary-50': isDragging }"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept=".pdf"
                  multiple
                  @change="handleFileSelect"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <UIcon name="i-heroicons-cloud-arrow-up" class="mx-auto h-12 w-12 text-gray-400 mb-4" />

                <div v-if="!selectedFiles.length">
                  <p class="text-lg text-gray-600 mb-2">
                    Drag and drop your PDF files here, or click to browse
                  </p>
                  <p class="text-sm text-gray-500">
                    Maximum file size: 50MB per file
                  </p>
                </div>

                <div v-else class="text-left space-y-2">
                  <div
                    v-for="(file, index) in selectedFiles"
                    :key="index"
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div class="flex items-center space-x-3">
                      <UIcon name="i-heroicons-document" class="h-8 w-8 text-red-500" />
                      <div>
                        <p class="text-sm font-medium text-gray-900">{{ file.name }}</p>
                        <p class="text-sm text-gray-500">{{ formatFileSize(file.size) }}</p>
                      </div>
                    </div>
                    <UButton
                      icon="i-heroicons-x-mark"
                      size="sm"
                      color="gray"
                      variant="ghost"
                      @click="removeFile(index)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Output Mode Radio -->
            <div class="p-4 bg-gray-800 rounded-lg space-y-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" :value="false" v-model="saveIndividual" class="accent-primary-500 w-4 h-4" />
                <div>
                  <p class="text-sm font-medium text-gray-200">Merge into one file</p>
                  <p class="text-xs text-gray-400">All pages combined into a single JPG</p>
                </div>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" :value="true" v-model="saveIndividual" class="accent-primary-500 w-4 h-4" />
                <div>
                  <p class="text-sm font-medium text-gray-200">Save to individual files</p>
                  <p class="text-xs text-gray-400">Each page saved as a separate JPG</p>
                </div>
              </label>
            </div>

            <!-- Quality Options -->
            <div class="p-4 bg-gray-800 rounded-lg grid grid-cols-2 gap-4 mt-5">
              <div>
                <label class="block text-sm font-medium text-gray-200 mb-1">Target width (px)</label>
                <input
                  v-model.number="targetWidth"
                  type="number"
                  min="1"
                  max="3000"
                  class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-200 mb-1">JPG quality (1–100)</label>
                <input
                  v-model.number="jpgQuality"
                  type="number"
                  min="10"
                  max="100"
                  class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <!-- Convert Button -->
            <div class="text-center mt-6">
              <UButton
                size="lg"
                :disabled="!selectedFiles.length"
                @click="convertFiles"
                class="px-8 py-3"
              >
                <UIcon name="i-heroicons-arrow-path" class="mr-2" />
                Convert to JPG
              </UButton>
            </div>
          </div>

          <!-- Processing State -->
          <div v-if="isProcessing" class="text-center py-12">
            <div class="mb-6">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                <UIcon name="i-heroicons-cog-6-tooth" class="h-8 w-8 text-primary-600 animate-spin" />
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                Converting your PDFs...
              </h3>
              <p class="text-sm text-gray-600">
                {{ processingMessage }}
              </p>
            </div>

            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out" :style="{ width: progress + '%' }"></div>
            </div>
            <p class="text-sm text-gray-500 mt-2">{{ Math.round(progress) }}% Complete</p>
          </div>

          <!-- Download State -->
          <div v-if="downloadFiles.length && !isProcessing" class="text-center py-12">
            <div class="mb-6">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <UIcon name="i-heroicons-check" class="h-8 w-8 text-green-600" />
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                Conversion Complete!
              </h3>
              <p class="text-sm text-gray-600 mb-6">
                {{ downloadFiles.length }} file{{ downloadFiles.length > 1 ? 's' : '' }} ready for download
              </p>
            </div>

            <div class="space-y-4">
              <div class="space-y-2">
                <div
                  v-for="file in downloadFiles"
                  :key="file.downloadUrl"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center space-x-3">
                    <UIcon name="i-heroicons-photo" class="h-6 w-6 text-primary-500" />
                    <span class="text-sm font-medium text-gray-900">{{ file.filename }}</span>
                  </div>
                  <UButton
                    size="sm"
                    :to="file.downloadUrl"
                    external
                    target="_blank"
                  >
                    <UIcon name="i-heroicons-arrow-down-tray" class="mr-1" />
                    Download
                  </UButton>
                </div>
              </div>

              <div class="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <UButton
                  v-if="downloadFiles.length > 1"
                  size="lg"
                  @click="downloadAll"
                  class="px-8 py-3"
                >
                  <UIcon name="i-heroicons-arrow-down-tray" class="mr-2" />
                  Save All
                </UButton>
                <UButton
                  size="lg"
                  color="gray"
                  variant="outline"
                  @click="reset"
                  class="px-8 py-3"
                >
                  <UIcon name="i-heroicons-arrow-path" class="mr-2" />
                  Convert Another File
                </UButton>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <UAlert
            v-if="error"
            color="red"
            variant="solid"
            :title="error"
            :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'white', variant: 'link', padded: false }"
            @close="error = ''"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Meta tags
useHead({
  title: 'PDF to JPG Converter',
  meta: [
    { name: 'description', content: 'Convert PDF files to high-quality JPG images online. Fast, secure, and easy to use.' }
  ]
})

// Reactive state
const selectedFiles = ref<File[]>([])
const isProcessing = ref(false)
const downloadFiles = ref<{ filename: string; downloadUrl: string }[]>([])
const error = ref('')
const isDragging = ref(false)
const progress = ref(0)
const processingMessage = ref('Initializing...')
const saveIndividual = ref(false)
const targetWidth = ref(2000)
const jpgQuality = ref(90)

const fileInput = ref<HTMLInputElement>()

// Methods
const addFiles = (files: FileList) => {
  const newFiles: File[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      error.value = `"${file.name}" is not a PDF file and was skipped`
      continue
    }
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      error.value = `"${file.name}" exceeds the 50MB limit and was skipped`
      continue
    }
    newFiles.push(file)
  }
  selectedFiles.value = [...selectedFiles.value, ...newFiles]
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length) {
    addFiles(input.files)
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  if (event.dataTransfer?.files && event.dataTransfer.files.length) {
    addFiles(event.dataTransfer.files)
  }
}

const removeFile = (index: number) => {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
  error.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const convertFiles = async () => {
  if (!selectedFiles.value.length) return

  isProcessing.value = true
  progress.value = 0
  error.value = ''
  downloadFiles.value = []

  const totalFiles = selectedFiles.value.length
  const allResults: { filename: string; downloadUrl: string }[] = []

  try {
    for (let i = 0; i < totalFiles; i++) {
      const file = selectedFiles.value[i]
      const fileProgress = (i / totalFiles) * 100
      const fileChunk = 100 / totalFiles

      processingMessage.value = `Uploading ${file.name} (${i + 1}/${totalFiles})...`
      progress.value = fileProgress + fileChunk * 0.2

      // Upload file
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await $fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      processingMessage.value = `Converting ${file.name} (${i + 1}/${totalFiles})...`
      progress.value = fileProgress + fileChunk * 0.4

      // Convert file
      const convertResponse = await $fetch('/api/convert', {
        method: 'POST',
        body: {
          filename: uploadResponse.filename,
          mergePages: !saveIndividual.value,
          targetWidth: targetWidth.value,
          jpgQuality: jpgQuality.value
        }
      })

      // Collect results
      if (convertResponse.files) {
        allResults.push(...convertResponse.files)
      } else {
        allResults.push({
          filename: convertResponse.outputFilename,
          downloadUrl: convertResponse.downloadUrl
        })
      }

      progress.value = fileProgress + fileChunk
    }

    progress.value = 100
    processingMessage.value = 'Conversion complete!'
    downloadFiles.value = allResults

    setTimeout(() => {
      isProcessing.value = false
    }, 500)

  } catch (err: any) {
    console.error('Conversion error:', err)
    error.value = err.data?.message || 'An error occurred during conversion'
    // Keep any results collected so far
    if (allResults.length) {
      downloadFiles.value = allResults
    }
    isProcessing.value = false
    progress.value = 0
  }
}

const downloadAll = () => {
  downloadFiles.value.forEach((file, index) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = file.downloadUrl
      a.download = file.filename
      a.click()
    }, index * 300)
  })
}

const reset = () => {
  selectedFiles.value = []
  downloadFiles.value = []
  error.value = ''
  progress.value = 0
  isProcessing.value = false
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Drag and drop event listeners
onMounted(() => {
  const handleDragEnter = () => {
    isDragging.value = true
  }

  const handleDragLeave = (event: DragEvent) => {
    if (!event.relatedTarget || !(event.target as Element).contains(event.relatedTarget as Node)) {
      isDragging.value = false
    }
  }

  document.addEventListener('dragenter', handleDragEnter)
  document.addEventListener('dragleave', handleDragLeave)

  onUnmounted(() => {
    document.removeEventListener('dragenter', handleDragEnter)
    document.removeEventListener('dragleave', handleDragLeave)
  })
})
</script>
