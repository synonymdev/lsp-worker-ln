'use strict'

const DEBUG_FLAG = 'LH:*'

const settings = {
  ignore_watch: 'status',
  watch: ['./src', './*js'],
  namespace: 'workers-ln'
}

module.exports = {
  apps: [
    {
      name: 'ln:worker',
      script: './start.js',
      env: {
        DEBUG: DEBUG_FLAG
      },
      env_production: {},
      ...settings
    }
  ]
}
