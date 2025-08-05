// playwright-test.config.js
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'

/** @type {import('playwright-test').RunnerOptions} */
const config = {
  buildConfig: {
    inject: ['./test/buffer-shim.js'],
    plugins: [
      nodeModulesPolyfillPlugin(),
    ],
  },
}

export default config
