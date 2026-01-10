import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'

export interface AppleTranscribeOptions {
  locale?: string
  live?: boolean
}

export interface AppleTranscribeResult {
  text: string
  error?: string
}

export async function transcribeWithAppleCLI(
  audioBlob: Buffer,
  options?: AppleTranscribeOptions
): Promise<AppleTranscribeResult> {

  // Get CLI binary path based on environment
  const assetsFolder = process.env.DEBUG ? 'assets' : process.resourcesPath
  const cliPath = path.join(assetsFolder, 'apple-speechanalyzer-cli')

  // Create temp directory for audio files
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'witsy-apple-stt-'))
  const inputPath = path.join(tempDir, 'input.wav')
  const outputPath = path.join(tempDir, 'output.txt')

  try {
    // Write audio blob to temp file
    await fs.writeFile(inputPath, audioBlob)

    // Build CLI arguments
    const args = [
      '--input-audio-path', inputPath,
      '--output-txt-path', outputPath,
    ]

    // Only pass locale if it's provided and not empty
    if (options?.locale && options.locale.trim().length > 0) {
      args.push('--locale', options.locale)
    }

    if (options?.live) {
      args.push('--live')
    }

    // Execute CLI
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(cliPath, args)

      let stderr = ''

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('error', (error) => {
        reject(new Error(`Failed to spawn CLI: ${error.message}`))
      })

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`CLI exited with code ${code}: ${stderr}`))
        }
      })
    })

    // Read transcription result
    const text = await fs.readFile(outputPath, 'utf-8')

    return { text: text.trim() }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[STT-Apple] Transcription failed:', errorMessage)
    return { text: '', error: errorMessage }

  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      console.error('[STT-Apple] Cleanup failed:', cleanupError)
    }
  }
}
