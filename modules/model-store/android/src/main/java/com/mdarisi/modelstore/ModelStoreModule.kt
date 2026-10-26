package com.mdarisi.modelstore

import android.content.Context
import android.os.StatFs
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileNotFoundException

// Headroom kept free after the copy so the phone stays usable.
private const val SPARE_BYTES = 200L * 1024 * 1024
private const val BUFFER_BYTES = 8 * 1024 * 1024

class ModelStoreModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ModelStore")

    Events("onCopyProgress")

    // Copies assets/models/<file> out of the APK into the app's private storage
    // (llama.cpp needs a real file path) and returns that path. Returns null when
    // the APK carries no such asset, as in debug builds.
    AsyncFunction("ensureBundledModel") { file: String ->
      val dest = File(context.filesDir, "models/$file")

      val fd = try {
        context.assets.openFd("models/$file")
      } catch (e: FileNotFoundException) {
        return@AsyncFunction null
      }
      val total = fd.use { it.length }

      if (dest.exists() && dest.length() == total) {
        return@AsyncFunction dest.absolutePath
      }

      dest.parentFile?.mkdirs()
      val tmp = File(dest.parentFile, "$file.tmp")
      tmp.delete()

      val free = StatFs(context.filesDir.absolutePath).availableBytes
      if (free < total + SPARE_BYTES) {
        throw CodedException(
          "ERR_NO_SPACE",
          "Need ${(total + SPARE_BYTES) / 1_000_000} MB free, have ${free / 1_000_000} MB",
          null
        )
      }

      context.assets.open("models/$file").use { input ->
        tmp.outputStream().use { output ->
          val buffer = ByteArray(BUFFER_BYTES)
          var copied = 0L
          var lastPct = -1
          while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            output.write(buffer, 0, n)
            copied += n
            val pct = (copied * 100 / total).toInt()
            if (pct != lastPct) {
              lastPct = pct
              sendEvent("onCopyProgress", mapOf("percentage" to pct))
            }
          }
        }
      }

      if (tmp.length() != total || !tmp.renameTo(dest)) {
        tmp.delete()
        throw CodedException("ERR_COPY_FAILED", "Copying the bundled model failed", null)
      }
      dest.absolutePath
    }
  }
}
