// Auto-generated napi-rs loader
// This file loads the correct native binary for the current platform

const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

const { platform, arch } = process

let nativeBinding = null
let localFileExisted = false
let loadError = null

function isMusl() {
  // For Node 10
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim()
      return readFileSync(lddPath, 'utf8').includes('musl')
    } catch (e) {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

switch (platform) {
  case 'android':
    switch (arch) {
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.android-arm64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.android-arm64.node')
          } else {
            nativeBinding = require('typescript-types-mock-android-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.android-arm-eabi.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.android-arm-eabi.node')
          } else {
            nativeBinding = require('typescript-types-mock-android-arm-eabi')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Android: ${arch}`)
    }
    break
  case 'win32':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.win32-x64-msvc.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.win32-x64-msvc.node')
          } else {
            nativeBinding = require('typescript-types-mock-win32-x64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'ia32':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.win32-ia32-msvc.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.win32-ia32-msvc.node')
          } else {
            nativeBinding = require('typescript-types-mock-win32-ia32-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.win32-arm64-msvc.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.win32-arm64-msvc.node')
          } else {
            nativeBinding = require('typescript-types-mock-win32-arm64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Windows: ${arch}`)
    }
    break
  case 'darwin':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.darwin-x64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.darwin-x64.node')
          } else {
            nativeBinding = require('typescript-types-mock-darwin-x64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.darwin-arm64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.darwin-arm64.node')
          } else {
            nativeBinding = require('typescript-types-mock-darwin-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`)
    }
    break
  case 'freebsd':
    if (arch !== 'x64') {
      throw new Error(`Unsupported architecture on FreeBSD: ${arch}`)
    }
    localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.freebsd-x64.node'))
    try {
      if (localFileExisted) {
        nativeBinding = require('./typescript-types-mock.freebsd-x64.node')
      } else {
        nativeBinding = require('typescript-types-mock-freebsd-x64')
      }
    } catch (e) {
      loadError = e
    }
    break
  case 'linux':
    switch (arch) {
      case 'x64':
        if (isMusl()) {
          localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.linux-x64-musl.node'))
          try {
            if (localFileExisted) {
              nativeBinding = require('./typescript-types-mock.linux-x64-musl.node')
            } else {
              nativeBinding = require('typescript-types-mock-linux-x64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.linux-x64-gnu.node'))
          try {
            if (localFileExisted) {
              nativeBinding = require('./typescript-types-mock.linux-x64-gnu.node')
            } else {
              nativeBinding = require('typescript-types-mock-linux-x64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm64':
        if (isMusl()) {
          localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.linux-arm64-musl.node'))
          try {
            if (localFileExisted) {
              nativeBinding = require('./typescript-types-mock.linux-arm64-musl.node')
            } else {
              nativeBinding = require('typescript-types-mock-linux-arm64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.linux-arm64-gnu.node'))
          try {
            if (localFileExisted) {
              nativeBinding = require('./typescript-types-mock.linux-arm64-gnu.node')
            } else {
              nativeBinding = require('typescript-types-mock-linux-arm64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm':
        localFileExisted = existsSync(join(__dirname, 'typescript-types-mock.linux-arm-gnueabihf.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./typescript-types-mock.linux-arm-gnueabihf.node')
          } else {
            nativeBinding = require('typescript-types-mock-linux-arm-gnueabihf')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`)
    }
    break
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

// Load helpers and context (pure JS, no native dependency)
const helpers = require('./helpers.cjs')
const context = require('./context.cjs')

// Export everything: native + helpers + context
module.exports = {
  // Native functions
  createMockFromFile: nativeBinding.createMockFromFile,
  createManyMocks: nativeBinding.createManyMocks,
  listTypes: nativeBinding.listTypes,
  mockFromSource: nativeBinding.mockFromSource,
  version: nativeBinding.version,
  // Playwright helpers
  createRouteResponse: helpers.createRouteResponse,
  createApiResponse: helpers.createApiResponse,
  createPaginatedResponse: helpers.createPaginatedResponse,
  // Mock context
  MockContext: context.MockContext,
  createMockContext: context.createMockContext,
}
