import { ref } from 'vue'
import { PREFS_FILE_NAME, PrefsError } from '~/lib/prefs/prefs'
import { downloadBlob } from './download'
import { usePreferences } from './usePreferences'

/** Export and import of the whole preferences record as a JSON file (`bianca-companion-preferences.json`). */
export function usePreferenceFiles() {
  const { exportText, importText } = usePreferences()
  /** Why the last import was refused; empty after a good one. */
  const importError = ref('')

  function exportFile(): void {
    downloadBlob(new Blob([exportText()], { type: 'application/json' }), PREFS_FILE_NAME)
  }

  /** Replace the preferences with the file's. A file that is not a preferences record changes nothing and sets `importError`. */
  async function importFile(file: File): Promise<void> {
    importError.value = ''
    let text: string
    try {
      text = await file.text()
    } catch {
      importError.value = 'That file could not be read.'
      return
    }
    try {
      importText(text)
    } catch (err) {
      importError.value = `Not imported: ${err instanceof PrefsError ? err.message : 'that file could not be used.'}`
    }
  }

  return { importError, exportFile, importFile }
}
